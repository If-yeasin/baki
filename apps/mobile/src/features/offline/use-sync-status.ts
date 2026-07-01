import { useSyncSnapshot } from "./use-queued-mutation-processor";
import type { QueuedMutationSyncSnapshot } from "./sync-orchestrator";

export type SyncStatus = {
  failedCount: number;
  pendingCount: number;
  state: "failed" | "idle" | "pending" | "syncing";
};

export function deriveSyncStatus(
  snapshot: Pick<QueuedMutationSyncSnapshot, "failedCount" | "isSyncing" | "pendingCount">
): SyncStatus {
  return {
    failedCount: snapshot.failedCount,
    pendingCount: snapshot.pendingCount,
    state: snapshot.isSyncing
      ? "syncing"
      : snapshot.failedCount > 0
        ? "failed"
        : snapshot.pendingCount > 0
          ? "pending"
          : "idle"
  };
}

export function useSyncStatus(): SyncStatus {
  return deriveSyncStatus(useSyncSnapshot());
}
