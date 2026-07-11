import {
  getQueueStats,
  processQueuedMutations,
  retryFailedQueuedMutations,
  subscribeToQueuedMutations,
  type ProcessQueuedMutationsResult
} from "./mutation-queue";
import { getPersistedUserId } from "../auth/session-storage";

export type QueuedMutationSyncSnapshot = {
  attempted: number;
  failed: number;
  failedCount: number;
  isSyncing: boolean;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  lastSyncAt?: string;
  pendingCount: number;
  retried: number;
  skipped: number;
  succeeded: number;
  totalCount: number;
};

type QueuedMutationSyncOptions = {
  reason?: "foreground" | "interval" | "manual" | "startup";
  retryFailed?: boolean;
};

const emptyResult: ProcessQueuedMutationsResult = {
  attempted: 0,
  failed: 0,
  retried: 0,
  skipped: 0,
  succeeded: 0
};

let latestResult = emptyResult;
let lastErrorCode: string | undefined;
let lastErrorMessage: string | undefined;
let lastSyncAt: string | undefined;
let isSyncing = false;
let activeRun: {
  ownerUserId: string;
  promise: Promise<QueuedMutationSyncSnapshot>;
} | null = null;
let cachedSnapshot: QueuedMutationSyncSnapshot | null = null;
let snapshotOwnerUserId = getPersistedUserId();

const syncListeners = new Set<() => void>();
const snapshotFields: { [Key in keyof QueuedMutationSyncSnapshot]-?: true } = {
  attempted: true,
  failed: true,
  failedCount: true,
  isSyncing: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  lastSyncAt: true,
  pendingCount: true,
  retried: true,
  skipped: true,
  succeeded: true,
  totalCount: true
};
const snapshotKeys = Object.keys(snapshotFields) as (keyof QueuedMutationSyncSnapshot)[];

export function getSyncSnapshot(): QueuedMutationSyncSnapshot {
  alignSyncStateToCurrentOwner();
  const stats = getQueueStats();
  const snapshot = {
    ...latestResult,
    failedCount: stats.failedCount,
    isSyncing,
    lastErrorCode,
    lastErrorMessage,
    lastSyncAt,
    pendingCount: stats.pendingCount,
    totalCount: stats.totalCount
  };

  if (cachedSnapshot && areSnapshotsEqual(cachedSnapshot, snapshot)) {
    return cachedSnapshot;
  }

  cachedSnapshot = snapshot;
  return snapshot;
}

export function subscribeToSyncState(listener: () => void) {
  syncListeners.add(listener);
  const unsubscribeQueue = subscribeToQueuedMutations(listener);

  return () => {
    syncListeners.delete(listener);
    unsubscribeQueue();
  };
}

export function runQueuedMutationSync(
  options: QueuedMutationSyncOptions = {}
): Promise<QueuedMutationSyncSnapshot> {
  const ownerUserId = getPersistedUserId();
  if (!ownerUserId) {
    return Promise.resolve(getSyncSnapshot());
  }

  if (activeRun) {
    if (activeRun.ownerUserId === ownerUserId) {
      return activeRun.promise;
    }

    return activeRun.promise.then(() => {
      if (getPersistedUserId() !== ownerUserId) {
        return getSyncSnapshot();
      }
      return runQueuedMutationSync(options);
    });
  }

  alignSyncStateToCurrentOwner();
  const run = (async () => {
    if (options.retryFailed) {
      retryFailedQueuedMutations();
    }

    isSyncing = true;
    lastErrorCode = undefined;
    lastErrorMessage = undefined;
    notifySyncListeners();

    try {
      const result = await processQueuedMutations();
      if (getPersistedUserId() === ownerUserId) {
        latestResult = result;
        lastSyncAt = new Date().toISOString();
      }
    } catch (error) {
      if (getPersistedUserId() === ownerUserId) {
        const details = getSyncErrorDetails(error);
        lastErrorCode = details.code;
        lastErrorMessage = details.message;
      }
    } finally {
      isSyncing = false;
      notifySyncListeners();
    }

    return getSyncSnapshot();
  })();

  activeRun = { ownerUserId, promise: run };
  void run.finally(() => {
    if (activeRun?.promise === run) {
      activeRun = null;
    }
  });

  return run;
}

function alignSyncStateToCurrentOwner() {
  const ownerUserId = getPersistedUserId();
  if (ownerUserId === snapshotOwnerUserId) {
    return;
  }

  snapshotOwnerUserId = ownerUserId;
  latestResult = emptyResult;
  lastErrorCode = undefined;
  lastErrorMessage = undefined;
  lastSyncAt = undefined;
  isSyncing = false;
  cachedSnapshot = null;
}

function notifySyncListeners() {
  for (const listener of syncListeners) {
    listener();
  }
}

function areSnapshotsEqual(
  previous: QueuedMutationSyncSnapshot,
  next: QueuedMutationSyncSnapshot
) {
  return snapshotKeys.every((key) => Object.is(previous[key], next[key]));
}

function getSyncErrorDetails(error: unknown): {
  code?: string;
  message: string;
} {
  const record =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;

  return {
    code: record && typeof record.code === "string" ? record.code : undefined,
    message:
      error instanceof Error
        ? error.message
        : record && typeof record.message === "string"
          ? record.message
          : "queued_mutation_sync_failed"
  };
}
