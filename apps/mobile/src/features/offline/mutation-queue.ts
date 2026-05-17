import { storage } from "@/lib/mmkv";

export type QueuedMutationType =
  | "group.create"
  | "expense.create"
  | "expense.update"
  | "expense.delete"
  | "settlement.create"
  | "profile.update";

export type QueuedMutation = {
  createdAt: string;
  id: string;
  payload: Record<string, unknown>;
  retryCount: number;
  type: QueuedMutationType;
};

const queueKey = "offline.mutationQueue.v1";

function readQueue(): QueuedMutation[] {
  const raw = storage.getString(queueKey);

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

function writeQueue(queue: QueuedMutation[]) {
  storage.set(queueKey, JSON.stringify(queue));
}

export function enqueueMutation(input: Omit<QueuedMutation, "createdAt" | "id" | "retryCount">) {
  const mutation: QueuedMutation = {
    ...input,
    createdAt: new Date().toISOString(),
    id: `${input.type}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    retryCount: 0
  };

  writeQueue([...readQueue(), mutation]);
  return mutation;
}

export function listQueuedMutations() {
  return readQueue();
}

export function removeQueuedMutation(id: string) {
  writeQueue(readQueue().filter((mutation) => mutation.id !== id));
}

export function markQueuedMutationRetried(id: string) {
  writeQueue(
    readQueue().map((mutation) =>
      mutation.id === id ? { ...mutation, retryCount: mutation.retryCount + 1 } : mutation
    )
  );
}
