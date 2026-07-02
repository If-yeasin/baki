import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

import { groupsKeys } from "./use-groups";
import type { GroupTemplate } from "./types";

function useInvalidateGroup(groupId: string) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: groupsKeys.list() });
    void queryClient.invalidateQueries({ queryKey: groupsKeys.detail(groupId) });
  };
}

export function useRenameGroup(groupId: string) {
  const invalidateGroup = useInvalidateGroup(groupId);

  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.rpc("rename_group", {
        p_group_id: groupId,
        p_name: name.trim()
      });

      if (error) {
        Sentry.captureException(error, { tags: { feature: "groups.rename" } });
        throw error;
      }
    },
    onSuccess: invalidateGroup
  });
}

export function useUpdateGroupTemplate(groupId: string) {
  const invalidateGroup = useInvalidateGroup(groupId);

  return useMutation({
    mutationFn: async (template: GroupTemplate) => {
      const { error } = await supabase.rpc("update_group_template", {
        p_group_id: groupId,
        p_template: template
      });

      if (error) {
        Sentry.captureException(error, { tags: { feature: "groups.updateTemplate" } });
        throw error;
      }
    },
    onSuccess: invalidateGroup
  });
}

export function useArchiveGroup(groupId: string) {
  const invalidateGroup = useInvalidateGroup(groupId);

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("archive_group", { p_group_id: groupId });

      if (error) {
        Sentry.captureException(error, { tags: { feature: "groups.archive" } });
        throw error;
      }
    },
    onSuccess: invalidateGroup
  });
}

export function useLeaveGroup(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_group", { p_group_id: groupId });

      if (error) {
        Sentry.captureException(error, { tags: { feature: "groups.leave" } });
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupsKeys.all });
    }
  });
}

export function useDeleteGroup(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_group", { p_group_id: groupId });

      if (error) {
        Sentry.captureException(error, { tags: { feature: "groups.delete" } });
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupsKeys.all });
    }
  });
}

export function useRegenerateGroupInvite(groupId: string) {
  const invalidateGroup = useInvalidateGroup(groupId);

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("regenerate_group_invite", {
        p_group_id: groupId
      });

      if (error) {
        Sentry.captureException(error, { tags: { feature: "groups.regenerateInvite" } });
        throw error;
      }

      if (!data) {
        throw new Error("groups.invite.regenerate_empty");
      }

      return data.toUpperCase();
    },
    onSuccess: invalidateGroup
  });
}
