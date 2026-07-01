import { useMutation, useQueryClient } from "@tanstack/react-query";

import { balancesKeys } from "@/features/balances/use-balances";
import { enqueueMutation } from "@/features/offline/mutation-queue";
import { expensesKeys } from "@/features/expenses/use-expenses";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

export type SettlementMethod = "bkash" | "nagad" | "cash" | "other";

export type CreateSettlementInput = {
  amountPaisa: number;
  externalRef?: string;
  fromUser: string;
  groupId: string;
  method: SettlementMethod;
  toUser: string;
};

export function useCreateSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSettlementInput) => {
      const rpcPayload = {
        p_amount_paisa: input.amountPaisa,
        ...(input.externalRef === undefined ? {} : { p_external_ref: input.externalRef }),
        p_from_user: input.fromUser,
        p_group_id: input.groupId,
        p_method: input.method,
        p_to_user: input.toUser
      };

      const { data: settlementId, error } = await supabase.rpc("create_settlement", rpcPayload);

      if (error) {
        Sentry.captureException(error, {
          tags: { feature: "settlement.create", phase: "rpc" }
        });
        enqueueMutation({
          payload: rpcPayload,
          type: "settlement.create"
        });
        throw error;
      }

      if (!settlementId) {
        throw new Error("settlement.create.empty_result");
      }

      return { settlementId };
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: balancesKeys.group(variables.groupId) });
      void queryClient.invalidateQueries({ queryKey: expensesKeys.list(variables.groupId) });
    }
  });
}
