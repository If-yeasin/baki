import { describe, expect, it } from "vitest";

import { buildGroupMonthlyReport, getCurrentDhakaMonthPeriod } from "./group-report";

describe("buildGroupMonthlyReport", () => {
  const members = new Map([
    ["tanvir", "Tanvir"],
    ["rini", "Rini"],
    ["sadman", "Sadman"]
  ]);

  it("summarizes a month without deleted or out-of-period ledger rows", () => {
    const report = buildGroupMonthlyReport({
      balances: [
        { netPaisa: 700, userId: "tanvir" },
        { netPaisa: -400, userId: "rini" },
        { netPaisa: -300, userId: "sadman" }
      ],
      expenses: [
        {
          amountPaisa: 120_000,
          category: "food",
          deletedAt: null,
          id: "expense-1",
          occurredAt: "2026-06-05T12:00:00.000Z",
          paidBy: "tanvir"
        },
        {
          amountPaisa: 80_000,
          category: "rent",
          deletedAt: null,
          id: "expense-2",
          occurredAt: "2026-06-15T12:00:00.000Z",
          paidBy: "rini"
        },
        {
          amountPaisa: 50_000,
          category: "food",
          deletedAt: null,
          id: "expense-outside-period",
          occurredAt: "2026-05-31T23:59:59.999Z",
          paidBy: "sadman"
        },
        {
          amountPaisa: 90_000,
          category: "transport",
          deletedAt: "2026-06-20T12:00:00.000Z",
          id: "expense-deleted",
          occurredAt: "2026-06-20T12:00:00.000Z",
          paidBy: "sadman"
        }
      ],
      generatedAt: "2026-07-01T00:00:00.000Z",
      groupName: "June Mess",
      members,
      period: {
        endAt: "2026-07-01T00:00:00.000Z",
        startAt: "2026-06-01T00:00:00.000Z"
      },
      settlements: [
        {
          amountPaisa: 30_000,
          fromUser: "rini",
          id: "settlement-1",
          method: "bkash",
          occurredAt: "2026-06-22T12:00:00.000Z",
          toUser: "tanvir"
        },
        {
          amountPaisa: 10_000,
          fromUser: "sadman",
          id: "settlement-outside-period",
          method: "cash",
          occurredAt: "2026-07-02T12:00:00.000Z",
          toUser: "tanvir"
        }
      ]
    });

    expect(report).toMatchObject({
      completedSettlementsCount: 1,
      expenseCount: 2,
      generatedAt: "2026-07-01T00:00:00.000Z",
      groupName: "June Mess",
      pendingBalanceCount: 3,
      totalExpensesPaisa: 200_000,
      totalSettledPaisa: 30_000
    });
    expect(report.highestPayer).toEqual({ amountPaisa: 120_000, displayName: "Tanvir", userId: "tanvir" });
    expect(report.categoryBreakdown).toEqual([
      { amountPaisa: 120_000, category: "food", count: 1 },
      { amountPaisa: 80_000, category: "rent", count: 1 }
    ]);
    expect(report.memberNetBalances).toEqual([
      { displayName: "Tanvir", netPaisa: 700, userId: "tanvir" },
      { displayName: "Sadman", netPaisa: -300, userId: "sadman" },
      { displayName: "Rini", netPaisa: -400, userId: "rini" }
    ]);
  });

  it("returns empty report sections when a month has no activity", () => {
    const report = buildGroupMonthlyReport({
      balances: [],
      expenses: [],
      generatedAt: "2026-07-01T00:00:00.000Z",
      groupName: "Quiet Khata",
      members,
      period: {
        endAt: "2026-07-01T00:00:00.000Z",
        startAt: "2026-06-01T00:00:00.000Z"
      },
      settlements: []
    });

    expect(report.highestPayer).toBeNull();
    expect(report.categoryBreakdown).toEqual([]);
    expect(report.memberNetBalances).toEqual([]);
    expect(report.totalExpensesPaisa).toBe(0);
  });
});

describe("getCurrentDhakaMonthPeriod", () => {
  it("returns the calendar month boundaries for the current Dhaka month", () => {
    expect(getCurrentDhakaMonthPeriod(new Date("2026-06-15T12:00:00.000Z"))).toEqual({
      endAt: "2026-06-30T18:00:00.000Z",
      startAt: "2026-05-31T18:00:00.000Z"
    });
  });
});
