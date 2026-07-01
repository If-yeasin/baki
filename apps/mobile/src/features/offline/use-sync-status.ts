import { useSyncSnapshot } from "./use-queued-mutation-processor";

export type SyncStatus = {
  failedCount: number;
  pendingCount: number;
  state: "failed" | "idle" | "pending" | "syncing";
};

export function useSyncStatus(): SyncStatus {
  const snapshot = useSyncSnapshot();

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
