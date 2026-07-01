import { describe, expect, it } from "vitest";

import type { QueuedMutation } from "./mutation-queue";
import {
  buildSyncDetailMetrics,
  formatSyncCount,
  selectFailedQueuedMutations
} from "./sync-details-view-model";
import type { QueuedMutationSyncSnapshot } from "./sync-orchestrator";

const snapshot: QueuedMutationSyncSnapshot = {
  attempted: 0,
  failed: 0,
  failedCount: 2,
  isSyncing: false,
  pendingCount: 3,
  retried: 0,
  skipped: 0,
  succeeded: 0,
  totalCount: 5
};

describe("sync details view model", () => {
  it("formats counts for Bengali and English locales", () => {
    expect(formatSyncCount(12, "bn")).toBe("১২");
    expect(formatSyncCount(12, "en")).toBe("12");
  });

  it("builds stable metrics for Settings -> Sync", () => {
    expect(
      buildSyncDetailMetrics({
        failedLabel: "Failed",
        lastSyncLabel: "Last sync",
        locale: "en",
        neverLabel: "Never",
        pendingLabel: "Pending",
        snapshot
      })
    ).toEqual([
      {
        label: "Pending",
        tone: "warning",
        value: "3"
      },
      {
        label: "Failed",
        tone: "negative",
        value: "2"
      },
      {
        label: "Last sync",
        tone: "neutral",
        value: "Never"
      }
    ]);
  });

  it("selects failed queued mutations for visible failed-item rows", () => {
    const queuedMutations = [
      {
        createdAt: "2026-07-01T00:00:00.000Z",
        id: "expense.create:pending",
        payload: {},
        retryCount: 0,
        status: "pending",
        type: "expense.create"
      },
      {
        createdAt: "2026-07-01T00:00:01.000Z",
        failedAt: "2026-07-01T00:00:02.000Z",
        id: "settlement.create:failed",
        payload: {},
        retryCount: 0,
        status: "failed",
        type: "settlement.create"
      }
    ] satisfies QueuedMutation[];

    expect(selectFailedQueuedMutations(queuedMutations).map((mutation) => mutation.id)).toEqual([
      "settlement.create:failed"
    ]);
  });
});
