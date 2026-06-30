import { useMutation, useQueryClient } from "@tanstack/react-query";

import { balancesKeys } from "@/features/balances/use-balances";
import { enqueueMutation } from "@/features/offline/mutation-queue";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

import { splitEqual, splitExact, splitPercent, splitShares, type SplitMethod } from "./split-math";
import type { ExpenseCategory } from "./types";
import { expensesKeys } from "./use-expenses";

export type CreateExpenseInput = {
  amountPaisa: number;
  category: ExpenseCategory;
  description: string;
  groupId: string;
  paidBy: string;
  splitMethod: SplitMethod;
  /** Member ids participating in the split. Required for `equal`. */
  splitMembers: readonly string[];
  /** Per-member raw shares for exact / percent / shares modes. */
  splitValues?: Record<string, number>;
};

export type CreateExpenseResult = {
  expenseId: string;
};

function computeShares(input: CreateExpenseInput): Record<string, number> {
  const { amountPaisa, paidBy, splitMethod, splitMembers, splitValues } = input;

  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0) {
    throw new Error("amount_must_be_positive_integer");
  }
  if (splitMembers.length === 0) {
    throw new Error("members_required");
  }
  if (splitMethod !== "equal" && (!splitValues || Object.keys(splitValues).length === 0)) {
    throw new Error("shares_required");
  }

  switch (splitMethod) {
    case "equal":
      return splitEqual(amountPaisa, splitMembers, { payerId: paidBy });
    case "exact":
      return splitExact(amountPaisa, splitValues ?? {});
    case "percent":
      return splitPercent(amountPaisa, splitValues ?? {}, { payerId: paidBy });
    case "shares":
      return splitShares(amountPaisa, splitValues ?? {}, { payerId: paidBy });
    default: {
      const exhaustive: never = splitMethod;
      throw new Error(`unsupported_split_method:${String(exhaustive)}`);
    }
  }
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateExpenseInput): Promise<CreateExpenseResult> => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("auth.error.session_failed");
      }

      const shares = computeShares(input);

      const rpcPayload = {
        p_amount_paisa: input.amountPaisa,
        p_category: input.category,
        p_description: input.description.trim(),
        p_group_id: input.groupId,
        p_paid_by: input.paidBy,
        p_shares: shares,
        p_split_method: input.splitMethod
      };

      const { data: expenseId, error } = await supabase.rpc("create_expense", rpcPayload);

      if (error) {
        Sentry.captureException(error, {
          tags: { feature: "expenses.create", phase: "rpc" }
        });
        enqueueMutation({
          payload: rpcPayload,
          type: "expense.create"
        });
        throw error;
      }

      if (!expenseId) {
        throw new Error("expense.create.empty_result");
      }

      return { expenseId };
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: expensesKeys.list(variables.groupId) });
      void queryClient.invalidateQueries({ queryKey: balancesKeys.group(variables.groupId) });
    }
  });
}
