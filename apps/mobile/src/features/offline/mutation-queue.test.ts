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

import {
  enqueueMutation,
  enqueueMoneyMutationFromRpcError,
  getQueueStats,
  listQueuedMutations,
  processQueuedMutations
} from "./mutation-queue";

const expensePayload = {
  p_amount_paisa: 1000,
  p_category: "food",
  p_client_mutation_id: "expense:test",
  p_description: "Dinner",
  p_group_id: "group-id",
  p_paid_by: "payer-id",
  p_shares: { "payer-id": 1000 },
  p_split_method: "equal"
};

const settlementPayload = {
  p_amount_paisa: 500,
  p_client_mutation_id: "settlement:test",
  p_from_user: "payer-id",
  p_group_id: "group-id",
  p_method: "bkash",
  p_to_user: "receiver-id"
};

describe("processQueuedMutations", () => {
  beforeEach(() => {
    mocks.values.clear();
    mocks.rpc.mockReset();
  });

  it("replays expense and settlement creates through RPC and removes successes", async () => {
    enqueueMutation({ payload: expensePayload, type: "expense.create" });
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" });

    mocks.rpc
      .mockResolvedValueOnce({ data: "expense-id", error: null })
      .mockResolvedValueOnce({ data: "settlement-id", error: null });

    const result = await processQueuedMutations();

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "create_expense", expensePayload);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "create_settlement", settlementPayload);
    expect(result).toEqual({
      attempted: 2,
      failed: 0,
      retried: 0,
      skipped: 0,
      succeeded: 2
    });
    expect(listQueuedMutations()).toEqual([]);
    expect(getQueueStats()).toEqual({ failedCount: 0, pendingCount: 0, totalCount: 0 });
  });

  it("increments retry count and keeps pending state for temporary failures", async () => {
    enqueueMutation({ payload: expensePayload, type: "expense.create" });

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error("Network request failed")
    });

    const result = await processQueuedMutations();
    const [mutation] = listQueuedMutations();

    expect(result.retried).toBe(1);
    expect(result.failed).toBe(0);
    expect(mutation?.retryCount).toBe(1);
    expect(mutation?.status).toBe("pending");
    expect(mutation?.lastErrorMessage).toBe("Network request failed");
    expect(getQueueStats()).toEqual({ failedCount: 0, pendingCount: 1, totalCount: 1 });
  });

  it("marks permanent validation failures and skips them on later replays", async () => {
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" });

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "amount_must_be_positive" }
    });

    const firstResult = await processQueuedMutations();
    const [failedMutation] = listQueuedMutations();

    expect(firstResult).toEqual({
      attempted: 1,
      failed: 1,
      retried: 0,
      skipped: 0,
      succeeded: 0
    });
    expect(failedMutation?.retryCount).toBe(0);
    expect(failedMutation?.status).toBe("failed");
    expect(failedMutation?.failedAt).toBeTruthy();
    expect(failedMutation?.lastErrorCode).toBe("23514");
    expect(failedMutation?.lastErrorMessage).toBe("amount_must_be_positive");
    expect(getQueueStats()).toEqual({ failedCount: 1, pendingCount: 0, totalCount: 1 });

    mocks.rpc.mockClear();

    const secondResult = await processQueuedMutations();

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(secondResult).toEqual({
      attempted: 0,
      failed: 0,
      retried: 0,
      skipped: 1,
      succeeded: 0
    });
  });
});

describe("enqueueMoneyMutationFromRpcError", () => {
  beforeEach(() => {
    mocks.values.clear();
    mocks.rpc.mockReset();
  });

  it("queues temporary money-write failures as pending success", () => {
    const result = enqueueMoneyMutationFromRpcError({
      error: new Error("Network request failed"),
      payload: expensePayload,
      type: "expense.create"
    });
    const [mutation] = listQueuedMutations();

    expect(result).toEqual({
      kind: "queued",
      queuedMutationId: mutation?.id
    });
    expect(mutation).toMatchObject({
      payload: expensePayload,
      retryCount: 0,
      status: "pending",
      type: "expense.create"
    });
    expect(getQueueStats()).toEqual({ failedCount: 0, pendingCount: 1, totalCount: 1 });
  });

  it("keeps permanent money-write failures visible as failed", () => {
    const result = enqueueMoneyMutationFromRpcError({
      error: { code: "42501", message: "not_group_member" },
      payload: settlementPayload,
      type: "settlement.create"
    });
    const [mutation] = listQueuedMutations();

    expect(result).toEqual({
      kind: "permanent",
      queuedMutationId: mutation?.id
    });
    expect(mutation).toMatchObject({
      failedAt: expect.any(String),
      lastErrorCode: "42501",
      lastErrorMessage: "not_group_member",
      payload: settlementPayload,
      retryCount: 0,
      status: "failed",
      type: "settlement.create"
    });
    expect(getQueueStats()).toEqual({ failedCount: 1, pendingCount: 0, totalCount: 1 });
  });
});
