import { useMutation, useQueryClient } from "@tanstack/react-query";

import { balancesKeys } from "@/features/balances/use-balances";
import { enqueueMutation } from "@/features/offline/mutation-queue";
import { expensesKeys } from "@/features/expenses/use-expenses";
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
      const payload = {
        amount_paisa: input.amountPaisa,
        external_ref: input.externalRef ?? null,
        from_user: input.fromUser,
        group_id: input.groupId,
        method: input.method,
        to_user: input.toUser
      };

      const { data, error } = await supabase
        .from("settlements")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        enqueueMutation({
          payload,
          type: "settlement.create"
        });
        throw error;
      }

      return { settlementId: data.id };
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: balancesKeys.group(variables.groupId) });
      void queryClient.invalidateQueries({ queryKey: expensesKeys.list(variables.groupId) });
    }
  });
}
