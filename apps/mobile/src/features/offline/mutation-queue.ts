import { storage } from "@/lib/mmkv";
import { supabase } from "@/lib/supabase";

import type { Database } from "@baki/db";

import { getPersistedUserId } from "../auth/session-storage";

type CreateExpensePayload = Database["public"]["Functions"]["create_expense"]["Args"];
type CreateGroupPayload = Database["public"]["Functions"]["create_group"]["Args"];
type CreateSettlementPayload = Database["public"]["Functions"]["create_settlement"]["Args"];
type DeleteExpensePayload = Database["public"]["Functions"]["delete_expense"]["Args"];
type UpdateExpensePayload = Database["public"]["Functions"]["edit_expense"]["Args"];

export type QueuedMutationStatus = "pending" | "failed";

export type QueuedMutationType =
  | "group.create"
  | "expense.create"
  | "expense.update"
  | "expense.delete"
  | "settlement.create"
  | "profile.update";

export type MoneyQueuedMutationType =
  | "expense.create"
  | "expense.update"
  | "expense.delete"
  | "settlement.create";

export type QueuedMutation = {
  createdAt: string;
  failedAt?: string;
  id: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  lastRetriedAt?: string;
  payload: Record<string, unknown>;
  retryCount: number;
  status?: QueuedMutationStatus;
  type: QueuedMutationType;
};

export type QueueStats = {
  failedCount: number;
  pendingCount: number;
  totalCount: number;
};

export type ProcessQueuedMutationsResult = {
  attempted: number;
  failed: number;
  retried: number;
  skipped: number;
  succeeded: number;
};

const queueKeyPrefix = "offline.mutationQueue.v2";
const unownedLegacyQueueKey = "offline.mutationQueue.v1";
const unownedLegacyQueueQuarantineKey = "offline.mutationQueue.quarantine.v1";
const queueListeners = new Set<() => void>();
const permanentErrorCodes = new Set([
  "22023",
  "22P02",
  "23502",
  "23503",
  "23505",
  "23514",
  "28000",
  "42501",
  "P0001",
  "empty_result"
]);

function queueKeyFor(ownerUserId: string): string {
  return `${queueKeyPrefix}.${ownerUserId}`;
}

function quarantineUnownedLegacyQueue() {
  const legacyQueue = storage.getString(unownedLegacyQueueKey);
  if (!legacyQueue) {
    return;
  }

  if (!storage.getString(unownedLegacyQueueQuarantineKey)) {
    storage.set(unownedLegacyQueueQuarantineKey, legacyQueue);
  }
  storage.delete(unownedLegacyQueueKey);
}

function readQueue(ownerUserId = getPersistedUserId()): QueuedMutation[] {
  // V1 had no account owner, so adopting it could replay another user's
  // financial mutations after an account switch. Preserve it only as an
  // inactive quarantine record for support/recovery; never replay it.
  quarantineUnownedLegacyQueue();

  if (!ownerUserId) {
    return [];
  }

  const raw = storage.getString(queueKeyFor(ownerUserId));

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[], ownerUserId = getPersistedUserId()) {
  if (!ownerUserId) {
    throw new Error("queued_mutation_owner_required");
  }

  storage.set(queueKeyFor(ownerUserId), JSON.stringify(queue));
  notifyQueueListeners();
}

function notifyQueueListeners() {
  for (const listener of queueListeners) {
    listener();
  }
}

export function subscribeToQueuedMutations(listener: () => void) {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

export function enqueueMutation(
  input: Omit<QueuedMutation, "createdAt" | "id" | "retryCount">,
  ownerUserId: string
) {
  const mutation: QueuedMutation = {
    ...input,
    createdAt: new Date().toISOString(),
    id: `${input.type}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    retryCount: 0,
    status: input.status ?? "pending"
  };

  writeQueue([...readQueue(ownerUserId), mutation], ownerUserId);
  return mutation;
}

export function listQueuedMutations() {
  return readQueue();
}

export function getQueueStats(): QueueStats {
  const queue = readQueue();
  const failedCount = queue.filter((mutation) => mutation.status === "failed").length;

  return {
    failedCount,
    pendingCount: queue.length - failedCount,
    totalCount: queue.length
  };
}

export function removeQueuedMutation(id: string, ownerUserId = getPersistedUserId()) {
  writeQueue(
    readQueue(ownerUserId).filter((mutation) => mutation.id !== id),
    ownerUserId
  );
}

export function markQueuedMutationRetried(
  id: string,
  error?: unknown,
  ownerUserId = getPersistedUserId()
) {
  const errorDetails = getQueuedMutationErrorDetails(error);

  writeQueue(
    readQueue(ownerUserId).map((mutation) =>
      mutation.id === id
        ? {
            ...mutation,
            failedAt: undefined,
            lastErrorCode: errorDetails.code,
            lastErrorMessage: errorDetails.message,
            lastRetriedAt: new Date().toISOString(),
            retryCount: mutation.retryCount + 1,
            status: "pending"
          }
        : mutation
    ),
    ownerUserId
  );
}

export function markQueuedMutationFailed(
  id: string,
  error?: unknown,
  ownerUserId = getPersistedUserId()
) {
  const errorDetails = getQueuedMutationErrorDetails(error);

  writeQueue(
    readQueue(ownerUserId).map((mutation) =>
      mutation.id === id
        ? {
            ...mutation,
            failedAt: new Date().toISOString(),
            lastErrorCode: errorDetails.code,
            lastErrorMessage: errorDetails.message,
            status: "failed"
          }
        : mutation
    ),
    ownerUserId
  );
}

export function retryFailedQueuedMutations() {
  const now = new Date().toISOString();
  let resetCount = 0;

  writeQueue(
    readQueue().map((mutation) => {
      if (mutation.status !== "failed") {
        return mutation;
      }

      resetCount += 1;
      return {
        ...mutation,
        failedAt: undefined,
        lastRetriedAt: now,
        status: "pending"
      };
    })
  );

  return resetCount;
}

export function isPermanentQueuedMutationError(error: unknown) {
  const details = getQueuedMutationErrorDetails(error);
  if (details.code && permanentErrorCodes.has(details.code)) {
    return true;
  }

  if (details.status === undefined) {
    return false;
  }

  if (details.status === 408 || details.status === 429) {
    return false;
  }

  return details.status >= 400 && details.status < 500;
}

export function enqueueMoneyMutationFromRpcError({
  error,
  ownerUserId,
  payload,
  type
}: {
  error: unknown;
  ownerUserId: string;
  payload: Record<string, unknown>;
  type: MoneyQueuedMutationType;
}): { kind: "permanent"; queuedMutationId: string } | { kind: "queued"; queuedMutationId: string } {
  const errorDetails = getQueuedMutationErrorDetails(error);
  const isPermanent = isPermanentQueuedMutationError(error);
  const mutation = enqueueMutation(
    {
      payload,
      type,
      ...(isPermanent
        ? {
            failedAt: new Date().toISOString(),
            lastErrorCode: errorDetails.code,
            lastErrorMessage: errorDetails.message,
            status: "failed" as const
          }
        : {})
    },
    ownerUserId
  );

  return {
    kind: isPermanent ? "permanent" : "queued",
    queuedMutationId: mutation.id
  };
}

export async function processQueuedMutations(): Promise<ProcessQueuedMutationsResult> {
  const result: ProcessQueuedMutationsResult = {
    attempted: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
    succeeded: 0
  };

  const ownerUserId = getPersistedUserId();
  if (!ownerUserId) {
    return result;
  }

  const queuedMutations = readQueue(ownerUserId);
  for (const [index, mutation] of queuedMutations.entries()) {
    if (getPersistedUserId() !== ownerUserId) {
      result.skipped += queuedMutations.length - index;
      break;
    }

    if (mutation.status === "failed") {
      result.skipped += 1;
      continue;
    }

    if (
      mutation.type !== "expense.create" &&
      mutation.type !== "expense.update" &&
      mutation.type !== "expense.delete" &&
      mutation.type !== "settlement.create" &&
      mutation.type !== "group.create"
    ) {
      result.skipped += 1;
      continue;
    }

    result.attempted += 1;

    const response =
      mutation.type === "expense.create"
        ? await supabase.rpc("create_expense", mutation.payload as CreateExpensePayload)
        : mutation.type === "expense.update"
          ? await supabase.rpc("edit_expense", mutation.payload as UpdateExpensePayload)
          : mutation.type === "expense.delete"
            ? await supabase.rpc("delete_expense", mutation.payload as DeleteExpensePayload)
            : mutation.type === "settlement.create"
              ? await supabase.rpc(
                  "create_settlement",
                  mutation.payload as CreateSettlementPayload
                )
              : await supabase.rpc("create_group", mutation.payload as CreateGroupPayload);

    if (getPersistedUserId() !== ownerUserId) {
      result.skipped += queuedMutations.length - index - 1;
      break;
    }

    if (response.error) {
      if (isPermanentQueuedMutationError(response.error)) {
        markQueuedMutationFailed(mutation.id, response.error, ownerUserId);
        result.failed += 1;
      } else {
        markQueuedMutationRetried(mutation.id, response.error, ownerUserId);
        result.retried += 1;
      }
      continue;
    }

    if (!response.data) {
      markQueuedMutationFailed(
        mutation.id,
        {
          code: "empty_result",
          message: `${mutation.type}.empty_result`
        },
        ownerUserId
      );
      result.failed += 1;
      continue;
    }

    removeQueuedMutation(mutation.id, ownerUserId);
    result.succeeded += 1;
  }

  return result;
}

export function getQueuedMutationErrorDetails(error: unknown): {
  code?: string;
  message: string;
  status?: number;
} {
  const record =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;

  const code = record && typeof record.code === "string" ? record.code : undefined;
  const status = record && typeof record.status === "number" ? record.status : undefined;
  const message =
    error instanceof Error
      ? error.message
      : record && typeof record.message === "string"
        ? record.message
        : "queued_mutation_failed";

  return { code, message, status };
}
