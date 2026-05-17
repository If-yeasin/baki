import { useEffect, useState } from "react";

import { listQueuedMutations } from "./mutation-queue";

export type SyncStatus = {
  pendingCount: number;
  state: "idle" | "pending";
};

export function useSyncStatus(pollMs = 5000): SyncStatus {
  const [pendingCount, setPendingCount] = useState(() => listQueuedMutations().length);

  useEffect(() => {
    const timer = setInterval(() => {
      setPendingCount(listQueuedMutations().length);
    }, pollMs);

    return () => clearInterval(timer);
  }, [pollMs]);

  return {
    pendingCount,
    state: pendingCount > 0 ? "pending" : "idle"
  };
}
