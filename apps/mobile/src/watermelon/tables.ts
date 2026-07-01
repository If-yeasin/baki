export const watermelonTables = {
  activityLog: "activity_log",
  expenseShares: "expense_shares",
  expenses: "expenses",
  groupMembers: "group_members",
  groups: "groups",
  settlements: "settlements"
} as const;

export type WatermelonTableName = (typeof watermelonTables)[keyof typeof watermelonTables];
