import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

import { toGroupSummary, UNKNOWN_DISPLAY_NAME, type GroupSummary } from "./types";
import { groupsKeys } from "./use-groups";

export type GroupMemberProfile = {
  displayName: string;
  joinedAt: string;
  leftAt: string | null;
  role: string;
  userId: string;
};

export type GroupDetail = {
  group: GroupSummary;
  members: GroupMemberProfile[];
};

async function fetchGroupDetail(groupId: string): Promise<GroupDetail> {
  const [groupResult, membersResult] = await Promise.all([
    supabase.from("groups").select("*").eq("id", groupId).single(),
    supabase
      .from("group_members")
      .select("group_id, user_id, role, joined_at, left_at, profiles!group_members_user_id_fkey(display_name)")
      .eq("group_id", groupId)
  ]);

  if (groupResult.error) {
    Sentry.captureException(groupResult.error, { tags: { feature: "groups.detail" } });
    throw groupResult.error;
  }
  if (membersResult.error) {
    Sentry.captureException(membersResult.error, { tags: { feature: "groups.detail" } });
    throw membersResult.error;
  }

  type MemberRow = {
    group_id: string;
    joined_at: string;
    left_at: string | null;
    role: string;
    user_id: string;
    profiles: { display_name: string } | { display_name: string }[] | null;
  };

  const members: GroupMemberProfile[] = (membersResult.data as MemberRow[] | null ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    return {
      displayName: profile?.display_name ?? UNKNOWN_DISPLAY_NAME,
      joinedAt: row.joined_at,
      leftAt: row.left_at,
      role: row.role,
      userId: row.user_id
    };
  });

  // TODO(offline-watermelon): read groups + group_members from local DB first.
  return {
    group: toGroupSummary(groupResult.data),
    members
  };
}

export function useGroupDetail(groupId: string | undefined) {
  return useQuery({
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchGroupDetail(groupId as string),
    queryKey: groupId ? groupsKeys.detail(groupId) : ["groups", "detail", "unknown"]
  });
}
