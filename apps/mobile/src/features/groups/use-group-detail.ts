import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import {
  readLocalGroup,
  readLocalGroupMembers,
  upsertRemoteGroupMembers,
  upsertRemoteGroups
} from "@/watermelon/repositories/groups";

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

async function readLocalGroupDetail(groupId: string): Promise<GroupDetail | null> {
  const [group, members] = await Promise.all([
    readLocalGroup(groupId),
    readLocalGroupMembers(groupId)
  ]);

  if (!group) {
    return null;
  }

  return {
    group,
    members: members
      .filter((member) => member.leftAt === null)
      .map((member) => ({
        displayName: UNKNOWN_DISPLAY_NAME,
        joinedAt: member.joinedAt,
        leftAt: member.leftAt,
        role: member.role,
        userId: member.userId
      }))
  };
}

export async function fetchGroupDetail(groupId: string): Promise<GroupDetail> {
  const localDetail = await readLocalGroupDetail(groupId);

  try {
    const [groupResult, membersResult] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase
        .from("group_members")
        .select(
          "group_id, user_id, role, joined_at, left_at, profiles!group_members_user_id_fkey(display_name)"
        )
        .eq("group_id", groupId)
        .is("left_at", null)
    ]);

    if (groupResult.error) {
      throw groupResult.error;
    }
    if (membersResult.error) {
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

    const memberRows = (membersResult.data as MemberRow[] | null) ?? [];
    const members: GroupMemberProfile[] = memberRows.map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

      return {
        displayName: profile?.display_name ?? UNKNOWN_DISPLAY_NAME,
        joinedAt: row.joined_at,
        leftAt: row.left_at,
        role: row.role,
        userId: row.user_id
      };
    });

    await Promise.all([
      upsertRemoteGroups([groupResult.data]),
      upsertRemoteGroupMembers(memberRows)
    ]);

    return {
      group: toGroupSummary(groupResult.data),
      members
    };
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "groups.detail" } });
    if (localDetail) {
      return localDetail;
    }

    throw error;
  }
}

export function useGroupDetail(groupId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!groupId) {
      return;
    }

    let cancelled = false;

    void readLocalGroupDetail(groupId).then((detail) => {
      if (!cancelled && detail) {
        queryClient.setQueryData(groupsKeys.detail(groupId), detail);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [groupId, queryClient]);

  return useQuery({
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchGroupDetail(groupId as string),
    queryKey: groupId ? groupsKeys.detail(groupId) : ["groups", "detail", "unknown"]
  });
}
