import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  from: vi.fn(),
  readLocalExpenses: vi.fn(),
  upsertRemoteExpenseShares: vi.fn(),
  upsertRemoteExpenses: vi.fn()
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: mocks.captureException
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from
  }
}));

vi.mock("@/watermelon/repositories/expenses", () => ({
  readLocalExpenses: mocks.readLocalExpenses,
  upsertRemoteExpenseShares: mocks.upsertRemoteExpenseShares,
  upsertRemoteExpenses: mocks.upsertRemoteExpenses
}));

import type { ExpenseRow, ExpenseSummary } from "./types";
import { fetchExpenses } from "./use-expenses";
import type { ExpenseShareRow } from "@/watermelon/repositories/expenses";

const remoteExpense = {
  amount_paisa: 1500,
  category: "food",
  client_mutation_id: "expense:1",
  created_at: "2026-07-01T00:00:00.000Z",
  created_by: "user-1",
  deleted_at: null,
  description: "Lunch",
  group_id: "group-1",
  id: "expense-1",
  note: null,
  occurred_at: "2026-07-01T00:00:00.000Z",
  paid_by: "user-1",
  receipt_url: null,
  split_method: "equal",
  updated_at: "2026-07-01T00:00:00.000Z"
} satisfies ExpenseRow;

const remoteShare = {
  expense_id: "expense-1",
  share_paisa: 750,
  user_id: "user-2"
} satisfies ExpenseShareRow;

const localExpense = {
  amountPaisa: 1200,
  category: "transport",
  description: "Rickshaw",
  id: "local-expense",
  occurredAt: "2026-06-30T00:00:00.000Z",
  paidBy: "user-2"
} satisfies ExpenseSummary;

function mockExpensesQuery(result: { data: ExpenseRow[] | null; error: unknown }) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis()
  };
  mocks.from.mockReturnValueOnce(query);
  return query;
}

function mockSharesQuery(result: { data: ExpenseShareRow[] | null; error: unknown }) {
  const query = {
    in: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis()
  };
  mocks.from.mockReturnValueOnce(query);
  return query;
}

describe("fetchExpenses", () => {
  beforeEach(() => {
    mocks.captureException.mockClear();
    mocks.from.mockReset();
    mocks.readLocalExpenses.mockReset();
    mocks.upsertRemoteExpenseShares.mockReset();
    mocks.upsertRemoteExpenses.mockReset();
  });

  it("returns local expenses when the remote query fails", async () => {
    const remoteError = new Error("offline");
    mocks.readLocalExpenses.mockResolvedValueOnce([localExpense]);
    mockExpensesQuery({ data: null, error: remoteError });

    await expect(fetchExpenses("group-1")).resolves.toEqual([localExpense]);
    expect(mocks.captureException).toHaveBeenCalledWith(remoteError, {
      tags: { feature: "expenses.list" }
    });
    expect(mocks.upsertRemoteExpenses).not.toHaveBeenCalled();
  });

  it("upserts remote expenses and shares into the local store", async () => {
    mocks.readLocalExpenses.mockResolvedValueOnce([]);
    mockExpensesQuery({ data: [remoteExpense], error: null });
    mockSharesQuery({ data: [remoteShare], error: null });

    await expect(fetchExpenses("group-1")).resolves.toEqual([
      {
        amountPaisa: 1500,
        category: "food",
        description: "Lunch",
        id: "expense-1",
        occurredAt: "2026-07-01T00:00:00.000Z",
        paidBy: "user-1"
      }
    ]);
    expect(mocks.upsertRemoteExpenseShares).toHaveBeenCalledWith([remoteShare]);
    expect(mocks.upsertRemoteExpenses).toHaveBeenCalledWith([remoteExpense]);
  });
});
