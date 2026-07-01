import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import {
  readLocalExpenses,
  upsertRemoteExpenses,
  upsertRemoteExpenseShares
} from "@/watermelon/repositories/expenses";

import { toExpenseSummary, type ExpenseSummary } from "./types";

export const expensesKeys = {
  all: ["expenses"] as const,
  list: (groupId: string) => [...expensesKeys.all, "list", groupId] as const
};

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
