import { describe, expect, it } from "vitest";

import type { QueuedMutation } from "./mutation-queue";
import {
  buildFailedQueuedMutationDebugText,
  buildSyncDetailMetrics,
  canDismissFailedQueuedMutation,
  formatFailedQueuedMutationSubtitle,
  formatSyncCount,
  redactSensitiveSyncText,
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

  it("redacts phone, token, JWT, and external reference text", () => {
    expect(
      redactSensitiveSyncText(
        "phone +8801712345678 token=secret Bearer eyJabc.def.ghi external_ref=bkash-123"
      )
    ).toBe(
      "phone [redacted-phone] token=[redacted] [redacted-jwt] external_ref=[redacted]"
    );
  });

  it("formats failed mutation subtitles with redacted messages", () => {
    const mutation = {
      createdAt: "2026-07-01T00:00:00.000Z",
      failedAt: "2026-07-01T00:00:02.000Z",
      id: "expense.delete:failed",
      lastErrorCode: "42501",
      lastErrorMessage: "not_group_member +8801712345678",
      payload: {},
      retryCount: 0,
      status: "failed",
      type: "expense.delete"
    } satisfies QueuedMutation;

    expect(formatFailedQueuedMutationSubtitle(mutation, "Unknown")).toBe(
      "42501 · not_group_member [redacted-phone]"
    );
  });

  it("allows dismiss only for failed permanent validation/auth errors", () => {
    expect(
      canDismissFailedQueuedMutation({
        createdAt: "2026-07-01T00:00:00.000Z",
        failedAt: "2026-07-01T00:00:02.000Z",
        id: "expense.create:failed",
        lastErrorCode: "23514",
        payload: {},
        retryCount: 0,
        status: "failed",
        type: "expense.create"
      })
    ).toBe(true);

    expect(
      canDismissFailedQueuedMutation({
        createdAt: "2026-07-01T00:00:00.000Z",
        id: "expense.create:pending",
        payload: {},
        retryCount: 0,
        status: "pending",
        type: "expense.create"
      })
    ).toBe(false);
  });

  it("builds redacted debug copy without raw payload values", () => {
    const debugText = buildFailedQueuedMutationDebugText({
      createdAt: "2026-07-01T00:00:00.000Z",
      failedAt: "2026-07-01T00:00:02.000Z",
      id: "settlement.create:failed",
      lastErrorCode: "42501",
      lastErrorMessage: "external_ref=trx-123 token=secret",
      payload: { external_ref: "trx-123" },
      retryCount: 2,
      status: "failed",
      type: "settlement.create"
    });

    expect(debugText).toContain("external_ref=[redacted]");
    expect(debugText).not.toContain("trx-123");
    expect(debugText).not.toContain("secret");
  });
});
