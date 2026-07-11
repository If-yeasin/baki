import { useMutation, useQueryClient } from "@tanstack/react-query";

import { balancesKeys } from "@/features/balances/use-balances";
import { simplifiedDebtsKeys } from "@/features/balances/use-simplified-debts";
import { activityKeys } from "@/features/activity/use-activity-log";
import { enqueueMoneyMutationFromRpcError } from "@/features/offline/mutation-queue";
import { expensesKeys } from "@/features/expenses/use-expenses";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

export type SettlementMethod = "bkash" | "nagad" | "cash" | "other";

export type CreateSettlementInput = {
  amountPaisa: number;
  clientMutationId?: string;
  externalRef?: string;
  fromUser: string;
  groupId: string;
  method: SettlementMethod;
  toUser: string;
};

export type CreateSettlementResult =
  | {
      settlementId: string;
      status: "synced";
    }
  | {
      queuedMutationId: string;
      status: "queued";
    };

function createClientMutationId() {
  return `settlement:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 12)}`;
}

export function buildCreateSettlementRpcPayload(input: CreateSettlementInput) {
  const clientMutationId = input.clientMutationId?.trim() || createClientMutationId();

  return {
    p_amount_paisa: input.amountPaisa,
    p_client_mutation_id: clientMutationId,
    ...(input.externalRef === undefined ? {} : { p_external_ref: input.externalRef }),
    p_from_user: input.fromUser,
    p_group_id: input.groupId,
    p_method: input.method,
    p_to_user: input.toUser
  };
}

export async function createSettlementWithOfflineQueue(
  input: CreateSettlementInput
): Promise<CreateSettlementResult> {
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
  const ownerUserId = session.user.id;

  const rpcPayload = buildCreateSettlementRpcPayload(input);

  const { data: settlementId, error } = await supabase.rpc("create_settlement", rpcPayload);

  if (error) {
    Sentry.captureException(error, {
      tags: { feature: "settlement.create", phase: "rpc" }
    });
    const queued = enqueueMoneyMutationFromRpcError({
      error,
      ownerUserId,
      payload: rpcPayload,
      type: "settlement.create"
    });
    if (queued.kind === "queued") {
      return {
        queuedMutationId: queued.queuedMutationId,
        status: "queued"
      };
    }
    throw error;
  }

  if (!settlementId) {
    throw new Error("settlement.create.empty_result");
  }

  return { settlementId, status: "synced" };
}

export function useCreateSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSettlementWithOfflineQueue,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: balancesKeys.group(variables.groupId) });
      void queryClient.invalidateQueries({
        queryKey: simplifiedDebtsKeys.group(variables.groupId)
      });
      void queryClient.invalidateQueries({ queryKey: activityKeys.group(variables.groupId) });
      void queryClient.invalidateQueries({ queryKey: expensesKeys.list(variables.groupId) });
    }
  });
}
