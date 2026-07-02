import { useMutation, useQueryClient } from "@tanstack/react-query";

import { balancesKeys } from "@/features/balances/use-balances";
import { enqueueMoneyMutationFromRpcError } from "@/features/offline/mutation-queue";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import {
  applyLocalExpenseDelete,
  applyLocalExpenseEdit
} from "@/watermelon/repositories/expenses";

import {
  computeExpenseShares,
  createExpenseClientMutationId,
  type ExpenseSplitInput
} from "./use-create-expense";
import type { ExpenseCategory } from "./types";
import { expensesKeys } from "./use-expenses";

export type UpdateExpenseInput = ExpenseSplitInput & {
  category: ExpenseCategory;
  clientMutationId?: string;
  description: string;
  expenseId: string;
  groupId: string;
  note?: string;
  occurredAt?: string;
  receiptUrl?: string;
};

export type DeleteExpenseInput = {
  clientMutationId?: string;
  expenseId: string;
  groupId: string;
};

export type ExpenseMutationResult =
  | {
      expenseId: string;
      status: "synced";
    }
  | {
      queuedMutationId: string;
      status: "queued";
    };

export function buildUpdateExpenseRpcPayload(input: UpdateExpenseInput) {
  const shares = computeExpenseShares(input);
  const clientMutationId =
    input.clientMutationId?.trim() || createExpenseClientMutationId("expense.update");

  return {
    p_amount_paisa: input.amountPaisa,
    p_category: input.category,
    p_client_mutation_id: clientMutationId,
    p_description: input.description.trim(),
    p_expense_id: input.expenseId,
    ...(input.note !== undefined ? { p_note: input.note } : {}),
    ...(input.occurredAt !== undefined ? { p_occurred_at: input.occurredAt } : {}),
    p_paid_by: input.paidBy,
    ...(input.receiptUrl !== undefined ? { p_receipt_url: input.receiptUrl } : {}),
    p_shares: shares,
    p_split_method: input.splitMethod
  };
}

export function buildDeleteExpenseRpcPayload(input: DeleteExpenseInput) {
  return {
    p_client_mutation_id:
      input.clientMutationId?.trim() || createExpenseClientMutationId("expense.delete"),
    p_expense_id: input.expenseId
  };
}

async function requireAuthenticatedSession() {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.user) {
    throw new Error("auth.error.session_failed");
  }
}

export async function updateExpenseWithOfflineQueue(
  input: UpdateExpenseInput
): Promise<ExpenseMutationResult> {
  await requireAuthenticatedSession();

  const rpcPayload = buildUpdateExpenseRpcPayload(input);
  const shares = rpcPayload.p_shares as Record<string, number>;

  const { data: expenseId, error } = await supabase.rpc("edit_expense", rpcPayload);

  if (error) {
    Sentry.captureException(error, {
      tags: { feature: "expenses.update", phase: "rpc" }
    });
    const queued = enqueueMoneyMutationFromRpcError({
      error,
      payload: rpcPayload,
      type: "expense.update"
    });
    if (queued.kind === "queued") {
      await applyLocalExpenseEdit({
        amountPaisa: input.amountPaisa,
        category: input.category,
        description: input.description.trim(),
        expenseId: input.expenseId,
        note: input.note,
        occurredAt: input.occurredAt,
        paidBy: input.paidBy,
        receiptUrl: input.receiptUrl,
        shares,
        splitMethod: input.splitMethod
      });
      return {
        queuedMutationId: queued.queuedMutationId,
        status: "queued"
      };
    }
    throw error;
  }

  if (!expenseId) {
    throw new Error("expense.update.empty_result");
  }

  await applyLocalExpenseEdit({
    amountPaisa: input.amountPaisa,
    category: input.category,
    description: input.description.trim(),
    expenseId,
    note: input.note,
    occurredAt: input.occurredAt,
    paidBy: input.paidBy,
    receiptUrl: input.receiptUrl,
    shares,
    splitMethod: input.splitMethod
  });

  return { expenseId, status: "synced" };
}

export async function deleteExpenseWithOfflineQueue(
  input: DeleteExpenseInput
): Promise<ExpenseMutationResult> {
  await requireAuthenticatedSession();

  const rpcPayload = buildDeleteExpenseRpcPayload(input);
  const { data: expenseId, error } = await supabase.rpc("delete_expense", rpcPayload);

  if (error) {
    Sentry.captureException(error, {
      tags: { feature: "expenses.delete", phase: "rpc" }
    });
    const queued = enqueueMoneyMutationFromRpcError({
      error,
      payload: rpcPayload,
      type: "expense.delete"
    });
    if (queued.kind === "queued") {
      await applyLocalExpenseDelete(input.expenseId);
      return {
        queuedMutationId: queued.queuedMutationId,
        status: "queued"
      };
    }
    throw error;
  }

  if (!expenseId) {
    throw new Error("expense.delete.empty_result");
  }

  await applyLocalExpenseDelete(expenseId);

  return { expenseId, status: "synced" };
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateExpenseWithOfflineQueue,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: expensesKeys.list(variables.groupId) });
      void queryClient.invalidateQueries({ queryKey: balancesKeys.group(variables.groupId) });
    }
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteExpenseWithOfflineQueue,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: expensesKeys.list(variables.groupId) });
      void queryClient.invalidateQueries({ queryKey: balancesKeys.group(variables.groupId) });
    }
  });
}
