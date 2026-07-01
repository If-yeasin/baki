import { describe, expect, it, vi } from "vitest";

vi.mock("./use-queued-mutation-processor", () => ({
  useSyncSnapshot: vi.fn()
}));

import { deriveSyncStatus } from "./use-sync-status";

describe("deriveSyncStatus", () => {
  it("prioritizes active sync over failed and pending counts", () => {
    expect(deriveSyncStatus({ failedCount: 2, isSyncing: true, pendingCount: 3 })).toEqual({
      failedCount: 2,
      pendingCount: 3,
      state: "syncing"
    });
  });

  it("shows failed before pending when not syncing", () => {
    expect(deriveSyncStatus({ failedCount: 1, isSyncing: false, pendingCount: 3 })).toEqual({
      failedCount: 1,
      pendingCount: 3,
      state: "failed"
    });
  });

  it("falls through to pending and idle states", () => {
    expect(deriveSyncStatus({ failedCount: 0, isSyncing: false, pendingCount: 1 }).state).toBe(
      "pending"
    );
    expect(deriveSyncStatus({ failedCount: 0, isSyncing: false, pendingCount: 0 }).state).toBe(
      "idle"
    );
  });
});
