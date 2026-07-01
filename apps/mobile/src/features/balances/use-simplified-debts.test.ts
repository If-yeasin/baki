import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: vi.fn()
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

import {
  buildRawBalanceFallbackPlan,
  buildUserSettlementPlan,
  type SimplifiedDebtRow
} from "./use-simplified-debts";

const rows: SimplifiedDebtRow[] = [
  { amount_paisa: 1200, from_user: "tanvir", to_user: "rini" },
  { amount_paisa: 400, from_user: "ahsan", to_user: "tanvir" },
  { amount_paisa: 900, from_user: "rini", to_user: "nadia" }
];

describe("buildUserSettlementPlan", () => {
  it("filters simplified debts to transfers involving the current user", () => {
    expect(buildUserSettlementPlan(rows, "tanvir")).toEqual([
      {
        amountPaisa: 1200,
        counterpartyId: "rini",
        direction: "pay",
        fromUser: "tanvir",
        toUser: "rini"
      },
      {
        amountPaisa: 400,
        counterpartyId: "ahsan",
        direction: "receive",
        fromUser: "ahsan",
        toUser: "tanvir"
      }
    ]);
  });

  it("returns an empty plan when the current user has no suggested transfers", () => {
    expect(buildUserSettlementPlan(rows, "farah")).toEqual([]);
  });
});

describe("buildRawBalanceFallbackPlan", () => {
  it("allocates the current user's debt to creditors using integer paisa", () => {
    expect(
      buildRawBalanceFallbackPlan(
        [
          { net_paisa: -1001, user_id: "tanvir" },
          { net_paisa: 700, user_id: "rini" },
          { net_paisa: 301, user_id: "ahsan" }
        ],
        "tanvir"
      )
    ).toEqual([
      {
        amountPaisa: 700,
        counterpartyId: "rini",
        direction: "pay",
        fromUser: "tanvir",
        toUser: "rini"
      },
      {
        amountPaisa: 301,
        counterpartyId: "ahsan",
        direction: "pay",
        fromUser: "tanvir",
        toUser: "ahsan"
      }
    ]);
  });

  it("assigns integer remainder paisa to the largest creditor", () => {
    expect(
      buildRawBalanceFallbackPlan(
        [
          { net_paisa: -1000, user_id: "tanvir" },
          { net_paisa: 2, user_id: "rini" },
          { net_paisa: 1, user_id: "ahsan" }
        ],
        "tanvir"
      )
    ).toEqual([
      {
        amountPaisa: 667,
        counterpartyId: "rini",
        direction: "pay",
        fromUser: "tanvir",
        toUser: "rini"
      },
      {
        amountPaisa: 333,
        counterpartyId: "ahsan",
        direction: "pay",
        fromUser: "tanvir",
        toUser: "ahsan"
      }
    ]);
  });

  it("returns no fallback transfers when the current user does not owe", () => {
    expect(
      buildRawBalanceFallbackPlan(
        [
          { net_paisa: 500, user_id: "tanvir" },
          { net_paisa: -500, user_id: "rini" }
        ],
        "tanvir"
      )
    ).toEqual([]);
  });
});
