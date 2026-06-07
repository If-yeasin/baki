import type { Database } from "@baki/db";

export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
export type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
export type ExpenseShareInsert = Database["public"]["Tables"]["expense_shares"]["Insert"];

export type ExpenseCategory =
  | "food"
  | "rent"
  | "utility"
  | "transport"
  | "entertainment"
  | "shopping"
  | "medical"
  | "education"
  | "gift"
  | "other";

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "food",
  "rent",
  "utility",
  "transport",
  "entertainment",
  "shopping",
  "medical",
  "education",
  "gift",
  "other"
] as const;

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export type ExpenseSummary = {
  amountPaisa: number;
  category: ExpenseCategory;
  description: string;
  id: string;
  occurredAt: string;
  paidBy: string;
};

export function toExpenseSummary(row: ExpenseRow): ExpenseSummary {
  return {
    amountPaisa: row.amount_paisa,
    category: isExpenseCategory(row.category) ? row.category : "other",
    description: row.description,
    id: row.id,
    occurredAt: row.occurred_at,
    paidBy: row.paid_by
  };
}
