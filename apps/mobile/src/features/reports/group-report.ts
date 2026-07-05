export type ReportPeriod = {
  endAt: string;
  startAt: string;
};

export type ReportExpense = {
  amountPaisa: number;
  category: string;
  deletedAt?: string | null;
  id: string;
  occurredAt: string;
  paidBy: string;
};

export type ReportSettlement = {
  amountPaisa: number;
  fromUser: string;
  id: string;
  method: string;
  occurredAt: string;
  toUser: string;
};

export type ReportBalance = {
  netPaisa: number;
  userId: string;
};

export type ReportMemberAmount = {
  amountPaisa: number;
  displayName: string;
  userId: string;
};

export type ReportMemberBalance = {
  displayName: string;
  netPaisa: number;
  userId: string;
};

export type ReportCategoryBreakdown = {
  amountPaisa: number;
  category: string;
  count: number;
};

export type GroupMonthlyReportInput = {
  balances: readonly ReportBalance[];
  expenses: readonly ReportExpense[];
  generatedAt?: string;
  groupName: string;
  members: ReadonlyMap<string, string>;
  period: ReportPeriod;
  settlements: readonly ReportSettlement[];
};

export type GroupMonthlyReport = {
  categoryBreakdown: ReportCategoryBreakdown[];
  completedSettlementsCount: number;
  expenseCount: number;
  generatedAt: string;
  groupName: string;
  highestPayer: ReportMemberAmount | null;
  memberNetBalances: ReportMemberBalance[];
  pendingBalanceCount: number;
  period: ReportPeriod;
  totalExpensesPaisa: number;
  totalSettledPaisa: number;
};

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

function isWithinPeriod(occurredAt: string, period: ReportPeriod): boolean {
  const occurred = new Date(occurredAt).getTime();
  return occurred >= new Date(period.startAt).getTime() && occurred < new Date(period.endAt).getTime();
}

function displayNameFor(members: ReadonlyMap<string, string>, userId: string): string {
  return members.get(userId) ?? userId;
}

function addAmount(map: Map<string, number>, key: string, amountPaisa: number) {
  map.set(key, (map.get(key) ?? 0) + amountPaisa);
}

export function buildGroupMonthlyReport(input: GroupMonthlyReportInput): GroupMonthlyReport {
  const activeExpenses = input.expenses.filter(
    (expense) => !expense.deletedAt && isWithinPeriod(expense.occurredAt, input.period)
  );
  const periodSettlements = input.settlements.filter((settlement) =>
    isWithinPeriod(settlement.occurredAt, input.period)
  );

  const paidByUser = new Map<string, number>();
  const categoryTotals = new Map<string, { amountPaisa: number; count: number }>();

  for (const expense of activeExpenses) {
    addAmount(paidByUser, expense.paidBy, expense.amountPaisa);
    const current = categoryTotals.get(expense.category) ?? { amountPaisa: 0, count: 0 };
    categoryTotals.set(expense.category, {
      amountPaisa: current.amountPaisa + expense.amountPaisa,
      count: current.count + 1
    });
  }

  const payerRows = Array.from(paidByUser.entries())
    .map(([userId, amountPaisa]) => ({
      amountPaisa,
      displayName: displayNameFor(input.members, userId),
      userId
    }))
    .sort(
      (a, b) =>
        b.amountPaisa - a.amountPaisa || a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId)
    );

  return {
    categoryBreakdown: Array.from(categoryTotals.entries())
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.amountPaisa - a.amountPaisa || a.category.localeCompare(b.category)),
    completedSettlementsCount: periodSettlements.length,
    expenseCount: activeExpenses.length,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    groupName: input.groupName,
    highestPayer: payerRows[0] ?? null,
    memberNetBalances: input.balances
      .filter((balance) => balance.netPaisa !== 0)
      .map((balance) => ({
        displayName: displayNameFor(input.members, balance.userId),
        netPaisa: balance.netPaisa,
        userId: balance.userId
      }))
      .sort(
        (a, b) =>
          b.netPaisa - a.netPaisa || a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId)
      ),
    pendingBalanceCount: input.balances.filter((balance) => balance.netPaisa !== 0).length,
    period: input.period,
    totalExpensesPaisa: activeExpenses.reduce((total, expense) => total + expense.amountPaisa, 0),
    totalSettledPaisa: periodSettlements.reduce(
      (total, settlement) => total + settlement.amountPaisa,
      0
    )
  };
}

export function getCurrentDhakaMonthPeriod(now = new Date()): ReportPeriod {
  const dhakaNow = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const year = dhakaNow.getUTCFullYear();
  const month = dhakaNow.getUTCMonth();

  return {
    endAt: new Date(Date.UTC(year, month + 1, 1) - DHAKA_OFFSET_MS).toISOString(),
    startAt: new Date(Date.UTC(year, month, 1) - DHAKA_OFFSET_MS).toISOString()
  };
}
