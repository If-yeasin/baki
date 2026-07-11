import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();

  return {
    rpc: vi.fn(),
    values
  };
});

vi.mock("@/lib/mmkv", () => ({
  storage: {
    delete: (key: string) => {
      mocks.values.delete(key);
    },
    getString: (key: string) => mocks.values.get(key),
    set: (key: string, value: string) => {
      mocks.values.set(key, value);
    }
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: mocks.rpc
  }
}));

import { enqueueMutation, listQueuedMutations } from "./mutation-queue";
import { getSyncSnapshot, runQueuedMutationSync } from "./sync-orchestrator";

const settlementPayload = {
  p_amount_paisa: 500,
  p_client_mutation_id: "settlement:test",
  p_from_user: "payer-id",
  p_group_id: "group-id",
  p_method: "cash",
  p_to_user: "receiver-id"
};

let testUserCounter = 0;

function currentTestUserId() {
  return mocks.values.get("auth.userId.v1") ?? "missing-test-user";
}

describe("runQueuedMutationSync", () => {
  beforeEach(() => {
    mocks.values.clear();
    mocks.values.set("auth.userId.v1", `test-user-${++testUserCounter}`);
    mocks.rpc.mockReset();
  });

  it("coalesces concurrent sync requests into one queue replay", async () => {
    enqueueMutation(
      { payload: settlementPayload, type: "settlement.create" },
      currentTestUserId()
    );

    let resolveRpc: (value: { data: string; error: null }) => void = () => undefined;
    mocks.rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRpc = resolve;
      })
    );

    const firstRun = runQueuedMutationSync({ reason: "manual" });
    const secondRun = runQueuedMutationSync({ reason: "foreground" });

    expect(firstRun).toBe(secondRun);
    expect(getSyncSnapshot().isSyncing).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);

    resolveRpc({ data: "settlement-id", error: null });
    const result = await firstRun;

    expect(result.succeeded).toBe(1);
    expect(result.pendingCount).toBe(0);
    expect(result.isSyncing).toBe(false);
    expect(listQueuedMutations()).toEqual([]);
  });

  it("returns the same snapshot reference while sync state is unchanged", () => {
    const firstSnapshot = getSyncSnapshot();
    const secondSnapshot = getSyncSnapshot();

    expect(secondSnapshot).toBe(firstSnapshot);

    enqueueMutation(
      { payload: settlementPayload, type: "settlement.create" },
      currentTestUserId()
    );

    const changedSnapshot = getSyncSnapshot();
    const stableChangedSnapshot = getSyncSnapshot();

    expect(changedSnapshot).not.toBe(firstSnapshot);
    expect(stableChangedSnapshot).toBe(changedSnapshot);
  });

  it("does not expose sync metadata after the authenticated user changes", async () => {
    enqueueMutation(
      { payload: settlementPayload, type: "settlement.create" },
      currentTestUserId()
    );
    mocks.rpc.mockResolvedValueOnce({ data: "settlement-id", error: null });

    const userASnapshot = await runQueuedMutationSync({ reason: "manual" });
    expect(userASnapshot.succeeded).toBe(1);
    expect(userASnapshot.lastSyncAt).toBeTruthy();

    mocks.values.set("auth.userId.v1", "user-b");

    expect(getSyncSnapshot()).toMatchObject({
      attempted: 0,
      failed: 0,
      failedCount: 0,
      pendingCount: 0,
      succeeded: 0,
      totalCount: 0
    });
    expect(getSyncSnapshot().lastSyncAt).toBeUndefined();
  });

  it("does not redirect a deferred account sync to a newer account", async () => {
    const userA = currentTestUserId();
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" }, userA);
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" }, userA);

    let resolveUserARpc: (value: { data: string; error: null }) => void = () => undefined;
    mocks.rpc
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveUserARpc = resolve;
        })
      )
      .mockResolvedValueOnce({ data: "unexpected-newer-user-result", error: null });

    const userARun = runQueuedMutationSync({ reason: "manual" });

    mocks.values.set("auth.userId.v1", "user-b");
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" }, "user-b");
    const deferredUserBRun = runQueuedMutationSync({ reason: "manual" });

    mocks.values.set("auth.userId.v1", "user-c");
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" }, "user-c");

    resolveUserARpc({ data: "user-a-settlement", error: null });
    await Promise.all([userARun, deferredUserBRun]);

    expect(mocks.rpc).toHaveBeenCalledTimes(1);

    mocks.values.set("auth.userId.v1", userA);
    expect(listQueuedMutations()).toHaveLength(2);
    mocks.values.set("auth.userId.v1", "user-b");
    expect(listQueuedMutations()).toHaveLength(1);
    mocks.values.set("auth.userId.v1", "user-c");
    expect(listQueuedMutations()).toHaveLength(1);
  });

  it("explicit retry resets failed mutations before replay", async () => {
    enqueueMutation(
      {
        payload: settlementPayload,
        status: "failed",
        type: "settlement.create"
      },
      currentTestUserId()
    );
    mocks.rpc.mockResolvedValueOnce({ data: "settlement-id", error: null });

    const result = await runQueuedMutationSync({ reason: "manual", retryFailed: true });

    expect(mocks.rpc).toHaveBeenCalledWith("create_settlement", settlementPayload);
    expect(result.succeeded).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.pendingCount).toBe(0);
    expect(listQueuedMutations()).toEqual([]);
  });
});
