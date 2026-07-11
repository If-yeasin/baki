import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  enqueueMutation,
  getQueuedMutationErrorDetails,
  isPermanentQueuedMutationError
} from "@/features/offline/mutation-queue";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

import { groupsKeys } from "./use-groups";
import { toGroupSummary, type GroupSummary, type GroupTemplate } from "./types";

export type CreateGroupInput = {
  name: string;
  template: GroupTemplate;
};

export type CreateGroupResult =
  | {
      group: GroupSummary;
      status: "synced";
    }
  | {
      queuedMutationId: string;
      status: "queued";
    };

function createClientMutationId() {
  return `group:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 12)}`;
}

export function buildCreateGroupRpcPayload(input: CreateGroupInput) {
  return {
    p_client_mutation_id: createClientMutationId(),
    p_name: input.name.trim(),
    p_template: input.template
  };
}

export async function createGroupWithOfflineQueue(
  input: CreateGroupInput
): Promise<CreateGroupResult> {
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

  const payload = buildCreateGroupRpcPayload(input);
  const { data: groupId, error } = await supabase.rpc("create_group", payload);

  if (error) {
    const errorDetails = getQueuedMutationErrorDetails(error);
    const permanent = isPermanentQueuedMutationError(error);
    const queuedMutation = enqueueMutation(
      {
        payload,
        type: "group.create",
        ...(permanent
          ? {
              failedAt: new Date().toISOString(),
              lastErrorCode: errorDetails.code,
              lastErrorMessage: errorDetails.message,
              status: "failed" as const
            }
          : {})
      },
      ownerUserId
    );
    Sentry.captureException(error, { tags: { feature: "groups.create" } });

    if (!permanent) {
      return {
        queuedMutationId: queuedMutation.id,
        status: "queued"
      };
    }

    throw error;
  }

  if (!groupId) {
    throw new Error("group.create.empty_result");
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (groupError) {
    throw groupError;
  }

  return { group: toGroupSummary(group), status: "synced" };
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGroupWithOfflineQueue,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupsKeys.list() });
    }
  });
}
