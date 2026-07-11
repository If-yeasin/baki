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

const updateExpensePayload = {
  p_amount_paisa: 1200,
  p_category: "food",
  p_client_mutation_id: "expense.update:test",
  p_description: "Dinner updated",
  p_expense_id: "expense-id",
  p_paid_by: "payer-id",
  p_shares: { "payer-id": 1200 },
  p_split_method: "exact"
};

const deleteExpensePayload = {
  p_client_mutation_id: "expense.delete:test",
  p_expense_id: "expense-id"
};

const groupPayload = {
  p_client_mutation_id: "group:test",
  p_name: "Sajek trip",
  p_template: "trip"
};

describe("processQueuedMutations", () => {
  beforeEach(() => {
    mocks.values.clear();
    mocks.values.set("auth.userId.v1", "user-a");
    mocks.rpc.mockReset();
  });

  it("does not expose or replay another user's queued mutations", async () => {
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" }, "user-a");

    mocks.values.set("auth.userId.v1", "user-b");
    mocks.rpc.mockResolvedValue({ data: "settlement-id", error: null });

    expect(listQueuedMutations()).toEqual([]);
    expect(await processQueuedMutations()).toEqual({
      attempted: 0,
      failed: 0,
      retried: 0,
      skipped: 0,
      succeeded: 0
    });
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.values.set("auth.userId.v1", "user-a");
    expect(listQueuedMutations()).toHaveLength(1);
  });

  it("pins a failed RPC mutation to the user who initiated it", () => {
    mocks.values.set("auth.userId.v1", "user-b");

    enqueueMutation({ payload: settlementPayload, type: "settlement.create" }, "user-a");

    expect(listQueuedMutations()).toEqual([]);
    mocks.values.set("auth.userId.v1", "user-a");
    expect(listQueuedMutations()).toHaveLength(1);
  });

  it("quarantines the unowned legacy queue instead of adopting it", () => {
    const legacyQueue = JSON.stringify([
      {
        createdAt: "2026-07-10T00:00:00.000Z",
        id: "legacy-settlement",
        payload: settlementPayload,
        retryCount: 0,
        status: "pending",
        type: "settlement.create"
      }
    ]);
    mocks.values.set("offline.mutationQueue.v1", legacyQueue);

    expect(listQueuedMutations()).toEqual([]);
    expect(mocks.values.has("offline.mutationQueue.v1")).toBe(false);
    expect(mocks.values.get("offline.mutationQueue.quarantine.v1")).toBe(legacyQueue);
  });

  it("replays queued ledger and group writes through RPC and removes successes", async () => {
    enqueueMutation({ payload: groupPayload, type: "group.create" }, "user-a");
    enqueueMutation({ payload: expensePayload, type: "expense.create" }, "user-a");
    enqueueMutation({ payload: updateExpensePayload, type: "expense.update" }, "user-a");
    enqueueMutation({ payload: deleteExpensePayload, type: "expense.delete" }, "user-a");
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" }, "user-a");

    mocks.rpc
      .mockResolvedValueOnce({ data: "group-id", error: null })
      .mockResolvedValueOnce({ data: "expense-id", error: null })
      .mockResolvedValueOnce({ data: "expense-id", error: null })
      .mockResolvedValueOnce({ data: "expense-id", error: null })
      .mockResolvedValueOnce({ data: "settlement-id", error: null });

    const result = await processQueuedMutations();

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "create_group", groupPayload);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "create_expense", expensePayload);
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, "edit_expense", updateExpensePayload);
    expect(mocks.rpc).toHaveBeenNthCalledWith(4, "delete_expense", deleteExpensePayload);
    expect(mocks.rpc).toHaveBeenNthCalledWith(5, "create_settlement", settlementPayload);
    expect(result).toEqual({
      attempted: 5,
      failed: 0,
      retried: 0,
      skipped: 0,
      succeeded: 5
    });
    expect(listQueuedMutations()).toEqual([]);
    expect(getQueueStats()).toEqual({ failedCount: 0, pendingCount: 0, totalCount: 0 });
  });

  it("increments retry count and keeps pending state for temporary failures", async () => {
    enqueueMutation({ payload: expensePayload, type: "expense.create" }, "user-a");

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
    enqueueMutation({ payload: settlementPayload, type: "settlement.create" }, "user-a");

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
    mocks.values.set("auth.userId.v1", "user-a");
    mocks.rpc.mockReset();
  });

  it("queues temporary money-write failures as pending success", () => {
    const result = enqueueMoneyMutationFromRpcError({
      error: new Error("Network request failed"),
      ownerUserId: "user-a",
      payload: updateExpensePayload,
      type: "expense.update"
    });
    const [mutation] = listQueuedMutations();

    expect(result).toEqual({
      kind: "queued",
      queuedMutationId: mutation?.id
    });
    expect(mutation).toMatchObject({
      payload: updateExpensePayload,
      retryCount: 0,
      status: "pending",
      type: "expense.update"
    });
    expect(getQueueStats()).toEqual({ failedCount: 0, pendingCount: 1, totalCount: 1 });
  });

  it("keeps permanent money-write failures visible as failed", () => {
    const result = enqueueMoneyMutationFromRpcError({
      error: { code: "42501", message: "not_group_member" },
      ownerUserId: "user-a",
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
