import { useEffect, useState } from "react";

import { getQueueStats } from "./mutation-queue";

export type SyncStatus = {
  failedCount: number;
  pendingCount: number;
  state: "failed" | "idle" | "pending";
};

export function useSyncStatus(pollMs = 5000): SyncStatus {
  const [stats, setStats] = useState(() => getQueueStats());

  useEffect(() => {
    const timer = setInterval(() => {
      setStats(getQueueStats());
    }, pollMs);

    return () => clearInterval(timer);
  }, [pollMs]);

  return {
    failedCount: stats.failedCount,
    pendingCount: stats.pendingCount,
    state: stats.failedCount > 0 ? "failed" : stats.pendingCount > 0 ? "pending" : "idle"
  };
}
