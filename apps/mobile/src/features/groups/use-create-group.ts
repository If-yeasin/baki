import { useMutation, useQueryClient } from "@tanstack/react-query";

import { enqueueMutation } from "@/features/offline/mutation-queue";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

import { groupsKeys } from "./use-groups";
import { toGroupSummary, type GroupSummary, type GroupTemplate } from "./types";

export type CreateGroupInput = {
  name: string;
  template: GroupTemplate;
};

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateGroupInput): Promise<GroupSummary> => {
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

      const trimmed = input.name.trim();
      const payload = {
        created_by: user.id,
        name: trimmed,
        template: input.template
      };

      const { data, error } = await supabase.from("groups").insert(payload).select("*").single();

      if (error) {
        // Persist the intent locally so the user's effort isn't lost when
        // offline. The sync worker (out of scope this wave) will drain it.
        enqueueMutation({
          payload: { ...payload, owner_user_id: user.id },
          type: "group.create"
        });
        Sentry.captureException(error, { tags: { feature: "groups.create" } });
        throw error;
      }

      return toGroupSummary(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupsKeys.list() });
    }
  });
}
