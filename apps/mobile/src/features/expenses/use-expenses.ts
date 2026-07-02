import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import {
  readLocalExpenses,
  readLocalExpenseRows,
  readLocalExpenseShares,
  upsertRemoteExpenses,
  upsertRemoteExpenseShares
} from "@/watermelon/repositories/expenses";

import { isExpenseCategory, toExpenseSummary, type ExpenseSummary } from "./types";

export type ExpenseDetail = ExpenseSummary & {
  note: string | null;
  receiptUrl: string | null;
  shares: Record<string, number>;
  splitMethod: "equal" | "exact" | "percent" | "shares";
};

export const expensesKeys = {
  all: ["expenses"] as const,
  detail: (groupId: string, expenseId: string) =>
    [...expensesKeys.all, "detail", groupId, expenseId] as const,
  list: (groupId: string) => [...expensesKeys.all, "list", groupId] as const
};

function toExpenseDetail(
  row: Parameters<typeof toExpenseSummary>[0],
  shares: Record<string, number>
): ExpenseDetail {
  const summary = toExpenseSummary(row);
  const splitMethod =
    row.split_method === "exact" ||
    row.split_method === "percent" ||
    row.split_method === "shares" ||
    row.split_method === "equal"
      ? row.split_method
      : "equal";

  return {
    ...summary,
    category: isExpenseCategory(row.category) ? row.category : "other",
    note: row.note,
    receiptUrl: row.receipt_url,
    shares,
    splitMethod
  };
}

async function readLocalExpenseDetail(
  groupId: string,
  expenseId: string
): Promise<ExpenseDetail | null> {
  const [expenseRows, shareRows] = await Promise.all([
    readLocalExpenseRows(groupId),
    readLocalExpenseShares(groupId)
  ]);
  const row = expenseRows.find((expense) => expense.id === expenseId);

  if (!row) {
    return null;
  }

  const shares = Object.fromEntries(
    shareRows
      .filter((share) => share.expense_id === expenseId)
      .map((share) => [share.user_id, share.share_paisa])
  );

  return {
    amountPaisa: row.amount_paisa,
    category: isExpenseCategory(row.category) ? row.category : "other",
    description: row.description,
    id: row.id,
    note: row.note,
    occurredAt: new Date(row.occurred_at).toISOString(),
    paidBy: row.paid_by,
    receiptUrl: row.receipt_url,
    shares,
    splitMethod:
      row.split_method === "exact" ||
      row.split_method === "percent" ||
      row.split_method === "shares" ||
      row.split_method === "equal"
        ? row.split_method
        : "equal"
  };
}

export async function fetchExpenses(groupId: string): Promise<ExpenseSummary[]> {
  const localExpenses = await readLocalExpenses(groupId);

  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false });

    if (error) {
      throw error;
    }

    const expenses = data ?? [];
    const expenseIds = expenses.map((expense) => expense.id);

    if (expenseIds.length > 0) {
      const sharesResult = await supabase
        .from("expense_shares")
        .select("*")
        .in("expense_id", expenseIds);

      if (sharesResult.error) {
        throw sharesResult.error;
      }

      await upsertRemoteExpenseShares(sharesResult.data ?? []);
    }

    await upsertRemoteExpenses(expenses);
    return expenses.map(toExpenseSummary);
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "expenses.list" } });
    if (localExpenses.length > 0) {
      return localExpenses;
    }
    throw error;
  }
}

export async function fetchExpenseDetail(
  groupId: string,
  expenseId: string
): Promise<ExpenseDetail> {
  const localDetail = await readLocalExpenseDetail(groupId, expenseId);

  try {
    const { data: expense, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", groupId)
      .eq("id", expenseId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!expense) {
      throw new Error("expense.detail.not_found");
    }

    const { data: shares, error: sharesError } = await supabase
      .from("expense_shares")
      .select("*")
      .eq("expense_id", expenseId);

    if (sharesError) {
      throw sharesError;
    }

    await Promise.all([
      upsertRemoteExpenses([expense]),
      upsertRemoteExpenseShares(shares ?? [])
    ]);

    return toExpenseDetail(
      expense,
      Object.fromEntries((shares ?? []).map((share) => [share.user_id, share.share_paisa]))
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "expenses.detail" } });
    if (localDetail) {
      return localDetail;
    }
    throw error;
  }
}

export function useExpenses(groupId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!groupId) {
      return;
    }

    let cancelled = false;

    void readLocalExpenses(groupId).then((expenses) => {
      if (!cancelled && expenses.length > 0) {
        queryClient.setQueryData(expensesKeys.list(groupId), expenses);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [groupId, queryClient]);

  return useQuery({
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchExpenses(groupId as string),
    queryKey: groupId ? expensesKeys.list(groupId) : ["expenses", "list", "unknown"]
  });
}

export function useExpenseDetail(groupId: string | undefined, expenseId: string | undefined) {
  return useQuery({
    enabled: Boolean(groupId && expenseId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchExpenseDetail(groupId as string, expenseId as string),
    queryKey:
      groupId && expenseId
        ? expensesKeys.detail(groupId, expenseId)
        : ["expenses", "detail", "unknown"]
  });
}
