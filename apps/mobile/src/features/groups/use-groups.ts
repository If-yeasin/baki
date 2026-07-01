import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import { readLocalGroups, upsertRemoteGroups } from "@/watermelon/repositories/groups";

import { toGroupSummary, type GroupSummary } from "./types";

export const groupsKeys = {
  all: ["groups"] as const,
  detail: (id: string) => [...groupsKeys.all, "detail", id] as const,
  list: () => [...groupsKeys.all, "list"] as const
};

export async function fetchGroups(): Promise<GroupSummary[]> {
  const localGroups = await readLocalGroups();

  try {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    await upsertRemoteGroups(data ?? []);
    return (data ?? []).map(toGroupSummary);
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "groups.list" } });
    if (localGroups.length > 0) {
      return localGroups;
    }
    throw error;
  }
}

export function useGroups() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    void readLocalGroups().then((groups) => {
      if (!cancelled && groups.length > 0) {
        queryClient.setQueryData(groupsKeys.list(), groups);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: fetchGroups,
    queryKey: groupsKeys.list(),
    staleTime: 1000 * 30
  });
}
