import type { Database } from "@baki/db";

import {
  isExpenseCategory,
  type ExpenseRow,
  type ExpenseSummary
} from "../../features/expenses/types";

import { fromWatermelonTimestamp, requiredTimestamp, toWatermelonTimestamp } from "../mappers";
import { watermelonTables } from "../tables";
import { fetchLocalRows, upsertLocalRows } from "./shared";

export type ExpenseShareRow = Database["public"]["Tables"]["expense_shares"]["Row"];

export type LocalExpenseRaw = {
  amount_paisa: number;
  category: string;
  client_mutation_id: string | null;
  created_by: string;
  deleted_at: number | null;
  description: string;
  group_id: string;
  id: string;
  note: string | null;
  occurred_at: number;
  paid_by: string;
  receipt_url: string | null;
  split_method: string;
  sync_status: string | null;
  updated_at: number;
};

export type LocalExpenseShareRaw = {
  expense_id: string;
  id: string;
  share_paisa: number;
  user_id: string;
};

export function mapExpenseRowToLocal(row: ExpenseRow): LocalExpenseRaw {
  return {
    amount_paisa: row.amount_paisa,
    category: row.category,
    client_mutation_id: row.client_mutation_id,
    created_by: row.created_by,
    deleted_at: toWatermelonTimestamp(row.deleted_at),
    description: row.description,
    group_id: row.group_id,
    id: row.id,
    note: row.note,
    occurred_at: requiredTimestamp(row.occurred_at),
    paid_by: row.paid_by,
    receipt_url: row.receipt_url,
    split_method: row.split_method,
    sync_status: null,
    updated_at: requiredTimestamp(row.updated_at)
  };
}

export function mapExpenseShareRowToLocal(row: ExpenseShareRow): LocalExpenseShareRaw {
  return {
    expense_id: row.expense_id,
    id: `${row.expense_id}:${row.user_id}`,
    share_paisa: row.share_paisa,
    user_id: row.user_id
  };
}

export function mapLocalExpenseToSummary(row: LocalExpenseRaw): ExpenseSummary {
  return {
    amountPaisa: row.amount_paisa,
    category: isExpenseCategory(row.category) ? row.category : "other",
    description: row.description,
    id: row.id,
    occurredAt: fromWatermelonTimestamp(row.occurred_at) ?? new Date(0).toISOString(),
    paidBy: row.paid_by
  };
}

export async function readLocalExpenses(groupId: string): Promise<ExpenseSummary[]> {
  const rows = await fetchLocalRows<LocalExpenseRaw>(watermelonTables.expenses);

  return rows
    .filter((row) => row.group_id === groupId && row.deleted_at === null)
    .sort((a, b) => b.occurred_at - a.occurred_at)
    .map(mapLocalExpenseToSummary);
}

export async function readLocalExpenseRows(groupId: string): Promise<LocalExpenseRaw[]> {
  const rows = await fetchLocalRows<LocalExpenseRaw>(watermelonTables.expenses);
  return rows.filter((row) => row.group_id === groupId && row.deleted_at === null);
}

export async function readLocalExpenseShares(groupId: string): Promise<LocalExpenseShareRaw[]> {
  const expenses = await readLocalExpenseRows(groupId);
  const expenseIds = new Set(expenses.map((expense) => expense.id));
  const rows = await fetchLocalRows<LocalExpenseShareRaw>(watermelonTables.expenseShares);

  return rows.filter((row) => expenseIds.has(row.expense_id));
}

export async function upsertRemoteExpenses(rows: readonly ExpenseRow[]) {
  await upsertLocalRows(watermelonTables.expenses, rows.map(mapExpenseRowToLocal));
}

export async function upsertRemoteExpenseShares(rows: readonly ExpenseShareRow[]) {
  await upsertLocalRows(watermelonTables.expenseShares, rows.map(mapExpenseShareRowToLocal));
}
