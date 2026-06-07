import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

import { toExpenseSummary, type ExpenseSummary } from "./types";

export const expensesKeys = {
  all: ["expenses"] as const,
  list: (groupId: string) => [...expensesKeys.all, "list", groupId] as const
};

async function fetchExpenses(groupId: string): Promise<ExpenseSummary[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });

  if (error) {
    Sentry.captureException(error, { tags: { feature: "expenses.list" } });
    throw error;
  }

  // TODO(offline-watermelon): hydrate from local expenses table before
  // the network call resolves.
  return (data ?? []).map(toExpenseSummary);
}

export function useExpenses(groupId: string | undefined) {
  return useQuery({
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchExpenses(groupId as string),
    queryKey: groupId ? expensesKeys.list(groupId) : ["expenses", "list", "unknown"]
  });
}
