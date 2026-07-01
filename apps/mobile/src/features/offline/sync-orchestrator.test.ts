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

describe("runQueuedMutationSync", () => {
  beforeEach(() => {
    mocks.values.clear();
    mocks.rpc.mockReset();
  });

  it("coalesces concurrent sync requests into one queue replay", async () => {
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" });

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

  it("explicit retry resets failed mutations before replay", async () => {
    enqueueMutation({
      payload: settlementPayload,
      status: "failed",
      type: "settlement.create"
    });
    mocks.rpc.mockResolvedValueOnce({ data: "settlement-id", error: null });

    const result = await runQueuedMutationSync({ reason: "manual", retryFailed: true });

    expect(mocks.rpc).toHaveBeenCalledWith("create_settlement", settlementPayload);
    expect(result.succeeded).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.pendingCount).toBe(0);
    expect(listQueuedMutations()).toEqual([]);
  });
});
