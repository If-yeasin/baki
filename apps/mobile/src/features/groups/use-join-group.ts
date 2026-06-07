import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

import { groupsKeys } from "./use-groups";

export type JoinGroupInput = {
  inviteCode: string;
};

export function useJoinGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inviteCode }: JoinGroupInput) => {
      const cleaned = inviteCode.trim().toUpperCase();
      const { data, error } = await supabase.rpc("accept_invite", {
        p_invite_code: cleaned
      });

      if (error) {
        Sentry.captureException(error, { tags: { feature: "groups.join" } });
        throw error;
      }

      return { groupId: data };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupsKeys.list() });
    }
  });
}
