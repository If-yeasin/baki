import type { Database } from "@baki/db";

import {
  isExpenseCategory,
  type ExpenseCategory,
  type ExpenseRow,
  type ExpenseSummary
} from "../../features/expenses/types";

import { fromWatermelonTimestamp, requiredTimestamp, toWatermelonTimestamp } from "../mappers";
import { watermelonTables } from "../tables";
import { deleteLocalRows, fetchLocalRows, upsertLocalRows } from "./shared";

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

export type LocalExpenseEditInput = {
  amountPaisa: number;
  category: ExpenseCategory;
  description: string;
  expenseId: string;
  note?: string | null;
  occurredAt?: string | null;
  paidBy: string;
  receiptUrl?: string | null;
  shares: Record<string, number>;
  splitMethod: string;
};

export async function applyLocalExpenseEdit(input: LocalExpenseEditInput) {
  const rows = await fetchLocalRows<LocalExpenseRaw>(watermelonTables.expenses);
  const existing = rows.find((row) => row.id === input.expenseId);

  if (!existing) {
    return;
  }

  const updatedAt = Date.now();
  await upsertLocalRows(watermelonTables.expenses, [
    {
      ...existing,
      amount_paisa: input.amountPaisa,
      category: input.category,
      deleted_at: null,
      description: input.description,
      note: input.note ?? existing.note,
      occurred_at: input.occurredAt
        ? (toWatermelonTimestamp(input.occurredAt) ?? existing.occurred_at)
        : existing.occurred_at,
      paid_by: input.paidBy,
      receipt_url: input.receiptUrl ?? existing.receipt_url,
      split_method: input.splitMethod,
      sync_status: null,
      updated_at: updatedAt
    }
  ]);

  await replaceLocalExpenseShares(input.expenseId, input.shares);
}

export async function applyLocalExpenseDelete(expenseId: string) {
  const rows = await fetchLocalRows<LocalExpenseRaw>(watermelonTables.expenses);
  const existing = rows.find((row) => row.id === expenseId);

  if (!existing) {
    return;
  }

  const now = Date.now();
  await upsertLocalRows(watermelonTables.expenses, [
    {
      ...existing,
      deleted_at: now,
      sync_status: null,
      updated_at: now
    }
  ]);
}

async function replaceLocalExpenseShares(expenseId: string, shares: Record<string, number>) {
  const existingShares = await fetchLocalRows<LocalExpenseShareRaw>(watermelonTables.expenseShares);
  const oldIds = existingShares
    .filter((share) => share.expense_id === expenseId)
    .map((share) => share.id);

  await deleteLocalRows(watermelonTables.expenseShares, oldIds);
  await upsertLocalRows(
    watermelonTables.expenseShares,
    Object.entries(shares).map(([userId, sharePaisa]) => ({
      expense_id: expenseId,
      id: `${expenseId}:${userId}`,
      share_paisa: sharePaisa,
      user_id: userId
    }))
  );
}

export async function upsertRemoteExpenses(rows: readonly ExpenseRow[]) {
  await upsertLocalRows(watermelonTables.expenses, rows.map(mapExpenseRowToLocal));
}

export async function upsertRemoteExpenseShares(rows: readonly ExpenseShareRow[]) {
  await upsertLocalRows(watermelonTables.expenseShares, rows.map(mapExpenseShareRowToLocal));
}
