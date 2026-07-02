import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: vi.fn()
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn()
  }
}));

vi.mock("@/features/groups/use-group-detail", () => ({
  fetchGroupDetail: vi.fn()
}));

vi.mock("@/watermelon/repositories/expenses", () => ({
  readLocalExpenseRows: vi.fn(),
  readLocalExpenseShares: vi.fn(),
  upsertRemoteExpenseShares: vi.fn(),
  upsertRemoteExpenses: vi.fn()
}));

import { buildGroupLedgerCsv, escapeCsvCell } from "./group-ledger-csv";

describe("escapeCsvCell", () => {
  it("quotes commas, quotes, and newlines", () => {
    expect(escapeCsvCell('Rice, fish "large"\nTea')).toBe('"Rice, fish ""large""\nTea"');
  });

  it("leaves simple cells unquoted", () => {
    expect(escapeCsvCell("BDT")).toBe("BDT");
    expect(escapeCsvCell(1200)).toBe("1200");
  });
});

describe("buildGroupLedgerCsv", () => {
  it("exports one row per expense share with member names and BDT values", () => {
    const csv = buildGroupLedgerCsv({
      expenses: [
        {
          amount_paisa: 1001,
          category: "food",
          description: "চা, নাস্তা",
          id: "expense-1",
          occurred_at: "2026-07-02T10:00:00.000Z",
          paid_by: "user-1",
          split_method: "equal"
        }
      ],
      groupName: "Sajek trip",
      members: new Map([
        ["user-1", "Tanvir"],
        ["user-2", "Rini"]
      ]),
      shares: [
        {
          expense_id: "expense-1",
          share_paisa: 501,
          user_id: "user-1"
        },
        {
          expense_id: "expense-1",
          share_paisa: 500,
          user_id: "user-2"
        }
      ]
    });

    expect(csv).toContain(
      "group_name,expense_id,expense_date,description,category,paid_by,amount_paisa,amount_bdt,split_method,member_name,member_share_paisa,member_share_bdt"
    );
    expect(csv).toContain(
      'Sajek trip,expense-1,2026-07-02T10:00:00.000Z,"চা, নাস্তা",food,Tanvir,1001,10.01,equal,Tanvir,501,5.01'
    );
    expect(csv).toContain(
      'Sajek trip,expense-1,2026-07-02T10:00:00.000Z,"চা, নাস্তা",food,Tanvir,1001,10.01,equal,Rini,500,5.00'
    );
  });
});
