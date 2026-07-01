import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { useSession } from "@/features/auth/use-session";

import {
  getSyncSnapshot,
  runQueuedMutationSync,
  subscribeToSyncState,
  type QueuedMutationSyncSnapshot
} from "./sync-orchestrator";

const defaultIntervalMs = 60_000;

export function useSyncSnapshot(): QueuedMutationSyncSnapshot {
  return useSyncExternalStore(subscribeToSyncState, getSyncSnapshot, getSyncSnapshot);
}

export function useQueuedMutationProcessor(intervalMs = defaultIntervalMs) {
  const session = useSession();
  const snapshot = useSyncSnapshot();
  const isAuthenticated = !session.isLoading && Boolean(session.userId);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void runQueuedMutationSync({ reason: "startup" });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void runQueuedMutationSync({ reason: "foreground" });
      }
    });

    const timer = setInterval(() => {
      void runQueuedMutationSync({ reason: "interval" });
    }, intervalMs);

    return () => {
      appStateSubscription.remove();
      clearInterval(timer);
    };
  }, [intervalMs, isAuthenticated]);

  const retryNow = useCallback(
    () => runQueuedMutationSync({ reason: "manual", retryFailed: true }),
    []
  );

  return {
    ...snapshot,
    isAuthenticated,
    isSessionReady: !session.isLoading,
    retryNow
  };
}
