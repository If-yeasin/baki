import {
  getQueueStats,
  processQueuedMutations,
  retryFailedQueuedMutations,
  subscribeToQueuedMutations,
  type ProcessQueuedMutationsResult
} from "./mutation-queue";

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
let activeRun: Promise<QueuedMutationSyncSnapshot> | null = null;

const syncListeners = new Set<() => void>();

export function getSyncSnapshot(): QueuedMutationSyncSnapshot {
  const stats = getQueueStats();

  return {
    ...latestResult,
    failedCount: stats.failedCount,
    isSyncing,
    lastErrorCode,
    lastErrorMessage,
    lastSyncAt,
    pendingCount: stats.pendingCount,
    totalCount: stats.totalCount
  };
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
  if (activeRun) {
    return activeRun;
  }

  const run = (async () => {
    if (options.retryFailed) {
      retryFailedQueuedMutations();
    }

    isSyncing = true;
    lastErrorCode = undefined;
    lastErrorMessage = undefined;
    notifySyncListeners();

    try {
      latestResult = await processQueuedMutations();
      lastSyncAt = new Date().toISOString();
    } catch (error) {
      const details = getSyncErrorDetails(error);
      lastErrorCode = details.code;
      lastErrorMessage = details.message;
    } finally {
      isSyncing = false;
      notifySyncListeners();
    }

    return getSyncSnapshot();
  })();

  activeRun = run;
  void run.finally(() => {
    if (activeRun === run) {
      activeRun = null;
    }
  });

  return run;
}

function notifySyncListeners() {
  for (const listener of syncListeners) {
    listener();
  }
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
