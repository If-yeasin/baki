import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyLocalExpenseDelete: vi.fn(),
  applyLocalExpenseEdit: vi.fn(),
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

vi.mock("@/watermelon/repositories/expenses", () => ({
  applyLocalExpenseDelete: mocks.applyLocalExpenseDelete,
  applyLocalExpenseEdit: mocks.applyLocalExpenseEdit
}));

vi.mock("./use-expenses", () => ({
  expensesKeys: {
    list: (groupId: string) => ["expenses", "list", groupId]
  }
}));

import {
  buildDeleteExpenseRpcPayload,
  buildUpdateExpenseRpcPayload,
  deleteExpenseWithOfflineQueue,
  updateExpenseWithOfflineQueue
} from "./use-update-expense";

const updateInput = {
  amountPaisa: 1001,
  category: "food" as const,
  clientMutationId: " expense.update:test-id ",
  description: "  চা-নাস্তা আপডেট  ",
  expenseId: "expense-id",
  groupId: "group-id",
  paidBy: "tanvir",
  splitMembers: ["tanvir", "rini"],
  splitMethod: "equal" as const
};

const deleteInput = {
  clientMutationId: " expense.delete:test-id ",
  expenseId: "expense-id",
  groupId: "group-id"
};

describe("expense update/delete payload builders", () => {
  it("builds trimmed edit RPC payloads with integer-paisa shares", () => {
    expect(buildUpdateExpenseRpcPayload(updateInput)).toEqual({
      p_amount_paisa: 1001,
      p_category: "food",
      p_client_mutation_id: "expense.update:test-id",
      p_description: "চা-নাস্তা আপডেট",
      p_expense_id: "expense-id",
      p_paid_by: "tanvir",
      p_shares: {
        rini: 500,
        tanvir: 501
      },
      p_split_method: "equal"
    });
  });

  it("builds trimmed delete RPC payloads", () => {
    expect(buildDeleteExpenseRpcPayload(deleteInput)).toEqual({
      p_client_mutation_id: "expense.delete:test-id",
      p_expense_id: "expense-id"
    });
  });
});

describe("updateExpenseWithOfflineQueue", () => {
  beforeEach(() => {
    mocks.applyLocalExpenseDelete.mockReset();
    mocks.applyLocalExpenseEdit.mockReset();
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

  it("returns queued success and applies local edit when temporary failures are queued", async () => {
    const error = new Error("Network request failed");
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.enqueueMoneyMutationFromRpcError.mockReturnValue({
      kind: "queued",
      queuedMutationId: "expense.update:queued"
    });

    await expect(updateExpenseWithOfflineQueue(updateInput)).resolves.toEqual({
      queuedMutationId: "expense.update:queued",
      status: "queued"
    });

    expect(mocks.rpc).toHaveBeenCalledWith("edit_expense", {
      p_amount_paisa: 1001,
      p_category: "food",
      p_client_mutation_id: "expense.update:test-id",
      p_description: "চা-নাস্তা আপডেট",
      p_expense_id: "expense-id",
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
        p_client_mutation_id: "expense.update:test-id"
      }),
      type: "expense.update"
    });
    expect(mocks.applyLocalExpenseEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaisa: 1001,
        description: "চা-নাস্তা আপডেট",
        expenseId: "expense-id"
      })
    );
    expect(mocks.captureException).toHaveBeenCalledWith(error, {
      tags: { feature: "expenses.update", phase: "rpc" }
    });
  });

  it("throws permanent edit failures after keeping them visible in the queue", async () => {
    const error = { code: "42501", message: "not_group_member" };
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.enqueueMoneyMutationFromRpcError.mockReturnValue({
      kind: "permanent",
      queuedMutationId: "expense.update:failed"
    });

    await expect(updateExpenseWithOfflineQueue(updateInput)).rejects.toBe(error);

    expect(mocks.applyLocalExpenseEdit).not.toHaveBeenCalled();
  });
});

describe("deleteExpenseWithOfflineQueue", () => {
  beforeEach(() => {
    mocks.applyLocalExpenseDelete.mockReset();
    mocks.applyLocalExpenseEdit.mockReset();
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

  it("returns queued success and marks the local expense deleted", async () => {
    const error = new Error("Network request failed");
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.enqueueMoneyMutationFromRpcError.mockReturnValue({
      kind: "queued",
      queuedMutationId: "expense.delete:queued"
    });

    await expect(deleteExpenseWithOfflineQueue(deleteInput)).resolves.toEqual({
      queuedMutationId: "expense.delete:queued",
      status: "queued"
    });

    expect(mocks.rpc).toHaveBeenCalledWith("delete_expense", {
      p_client_mutation_id: "expense.delete:test-id",
      p_expense_id: "expense-id"
    });
    expect(mocks.enqueueMoneyMutationFromRpcError).toHaveBeenCalledWith({
      error,
      ownerUserId: "tanvir",
      payload: expect.objectContaining({
        p_client_mutation_id: "expense.delete:test-id"
      }),
      type: "expense.delete"
    });
    expect(mocks.applyLocalExpenseDelete).toHaveBeenCalledWith("expense-id");
  });
});
