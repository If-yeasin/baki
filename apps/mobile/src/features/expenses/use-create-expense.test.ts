import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  enqueueMoneyMutationFromRpcError: vi.fn(),
  getSession: vi.fn(),
  rpc: vi.fn()
}));

vi.mock("@/features/balances/use-balances", () => ({
  balancesKeys: {
    group: (groupId: string) => ["balances", "group", groupId]
  }
}));

vi.mock("@/features/offline/mutation-queue", () => ({
  enqueueMoneyMutationFromRpcError: mocks.enqueueMoneyMutationFromRpcError
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: mocks.captureException
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession
    },
    rpc: mocks.rpc
  }
}));

vi.mock("./use-expenses", () => ({
  expensesKeys: {
    list: (groupId: string) => ["expenses", "list", groupId]
  }
}));

import { buildCreateExpenseRpcPayload, createExpenseWithOfflineQueue } from "./use-create-expense";

const input = {
  amountPaisa: 1001,
  category: "food" as const,
  clientMutationId: " expense:test-id ",
  description: "  চা-নাস্তা  ",
  groupId: "group-id",
  paidBy: "tanvir",
  splitMembers: ["tanvir", "rini"],
  splitMethod: "equal" as const
};

describe("buildCreateExpenseRpcPayload", () => {
  it("preserves a provided client mutation id and integer-paisa shares", () => {
    expect(buildCreateExpenseRpcPayload(input)).toEqual({
      p_amount_paisa: 1001,
      p_category: "food",
      p_client_mutation_id: "expense:test-id",
      p_description: "চা-নাস্তা",
      p_group_id: "group-id",
      p_paid_by: "tanvir",
      p_shares: {
        rini: 500,
        tanvir: 501
      },
      p_split_method: "equal"
    });
  });
});

describe("createExpenseWithOfflineQueue", () => {
  beforeEach(() => {
    mocks.captureException.mockReset();
    mocks.enqueueMoneyMutationFromRpcError.mockReset();
    mocks.getSession.mockReset();
    mocks.rpc.mockReset();
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "tanvir"
          }
        }
      },
      error: null
    });
  });

  it("returns queued success when a temporary RPC failure is queued", async () => {
    const error = new Error("Network request failed");
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.enqueueMoneyMutationFromRpcError.mockReturnValue({
      kind: "queued",
      queuedMutationId: "expense.create:queued"
    });

    await expect(createExpenseWithOfflineQueue(input)).resolves.toEqual({
      queuedMutationId: "expense.create:queued",
      status: "queued"
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_expense", {
      p_amount_paisa: 1001,
      p_category: "food",
      p_client_mutation_id: "expense:test-id",
      p_description: "চা-নাস্তা",
      p_group_id: "group-id",
      p_paid_by: "tanvir",
      p_shares: {
        rini: 500,
        tanvir: 501
      },
      p_split_method: "equal"
    });
    expect(mocks.enqueueMoneyMutationFromRpcError).toHaveBeenCalledWith({
      error,
      ownerUserId: "tanvir",
      payload: expect.objectContaining({
        p_client_mutation_id: "expense:test-id"
      }),
      type: "expense.create"
    });
    expect(mocks.captureException).toHaveBeenCalledWith(error, {
      tags: { feature: "expenses.create", phase: "rpc" }
    });
  });

  it("throws permanent RPC failures after keeping them visible in the queue", async () => {
    const error = { code: "42501", message: "not_group_member" };
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.enqueueMoneyMutationFromRpcError.mockReturnValue({
      kind: "permanent",
      queuedMutationId: "expense.create:failed"
    });

    await expect(createExpenseWithOfflineQueue(input)).rejects.toBe(error);

    expect(mocks.enqueueMoneyMutationFromRpcError).toHaveBeenCalledWith({
      error,
      ownerUserId: "tanvir",
      payload: expect.objectContaining({
        p_client_mutation_id: "expense:test-id"
      }),
      type: "expense.create"
    });
  });
});
