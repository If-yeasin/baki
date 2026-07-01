import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("../database", () => ({
  getBakiDatabase: () => null
}));

import { computeBalancesFromLocalRows, type LocalSettlementRaw } from "./balances";
import type { LocalExpenseRaw, LocalExpenseShareRaw } from "./expenses";

const baseExpense = {
  category: "food",
  client_mutation_id: null,
  created_by: "tanvir",
  deleted_at: null,
  description: "Dinner",
  group_id: "group",
  note: null,
  occurred_at: 1,
  receipt_url: null,
  split_method: "equal",
  sync_status: null,
  updated_at: 1
} satisfies Omit<LocalExpenseRaw, "amount_paisa" | "id" | "paid_by">;

function expense(input: {
  amountPaisa: number;
  deleted?: boolean;
  id: string;
  paidBy: string;
}): LocalExpenseRaw {
  return {
    ...baseExpense,
    amount_paisa: input.amountPaisa,
    deleted_at: input.deleted ? 2 : null,
    id: input.id,
    paid_by: input.paidBy
  };
}

function share(input: {
  expenseId: string;
  sharePaisa: number;
  userId: string;
}): LocalExpenseShareRaw {
  return {
    expense_id: input.expenseId,
    id: `${input.expenseId}:${input.userId}`,
    share_paisa: input.sharePaisa,
    user_id: input.userId
  };
}

function settlement(input: {
  amountPaisa: number;
  fromUser: string;
  id: string;
  toUser: string;
}): LocalSettlementRaw {
  return {
    amount_paisa: input.amountPaisa,
    client_mutation_id: null,
    external_ref: null,
    from_user: input.fromUser,
    group_id: "group",
    id: input.id,
    method: "cash",
    occurred_at: 3,
    sync_status: null,
    to_user: input.toUser,
    updated_at: 3
  };
}

describe("computeBalancesFromLocalRows", () => {
  it("computes server-style net balances from expenses and shares", () => {
    const result = computeBalancesFromLocalRows({
      expenseShares: [
        share({ expenseId: "expense-1", sharePaisa: 500, userId: "tanvir" }),
        share({ expenseId: "expense-1", sharePaisa: 500, userId: "rini" })
      ],
      expenses: [expense({ amountPaisa: 1000, id: "expense-1", paidBy: "tanvir" })],
      settlements: []
    });

    expect(result).toEqual([
      { net_paisa: 500, user_id: "tanvir" },
      { net_paisa: -500, user_id: "rini" }
    ]);
  });

  it("excludes deleted expenses and their shares", () => {
    const result = computeBalancesFromLocalRows({
      expenseShares: [
        share({ expenseId: "deleted-expense", sharePaisa: 500, userId: "tanvir" }),
        share({ expenseId: "deleted-expense", sharePaisa: 500, userId: "rini" })
      ],
      expenses: [
        expense({
          amountPaisa: 1000,
          deleted: true,
          id: "deleted-expense",
          paidBy: "tanvir"
        })
      ],
      settlements: []
    });

    expect(result).toEqual([]);
  });

  it("applies settlements to reduce outstanding balances", () => {
    const result = computeBalancesFromLocalRows({
      expenseShares: [
        share({ expenseId: "expense-1", sharePaisa: 500, userId: "tanvir" }),
        share({ expenseId: "expense-1", sharePaisa: 500, userId: "rini" })
      ],
      expenses: [expense({ amountPaisa: 1000, id: "expense-1", paidBy: "tanvir" })],
      settlements: [
        settlement({
          amountPaisa: 300,
          fromUser: "rini",
          id: "settlement-1",
          toUser: "tanvir"
        })
      ]
    });

    expect(result).toEqual([
      { net_paisa: 200, user_id: "tanvir" },
      { net_paisa: -200, user_id: "rini" }
    ]);
  });
});
