import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

import { toGroupSummary, type GroupSummary } from "./types";

export const groupsKeys = {
  all: ["groups"] as const,
  detail: (id: string) => [...groupsKeys.all, "detail", id] as const,
  list: () => [...groupsKeys.all, "list"] as const
};

async function fetchGroups(): Promise<GroupSummary[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    Sentry.captureException(error, { tags: { feature: "groups.list" } });
    throw error;
  }

  // TODO(offline-watermelon): hydrate from WatermelonDB groups table before
  // this network call resolves, so the UI shows a list instantly on cold
  // start. Until the sync engine is wired up, TanStack Query's cache + the
  // placeholder below cover the warm-cache case.
  return (data ?? []).map(toGroupSummary);
}

export function useGroups() {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: fetchGroups,
    queryKey: groupsKeys.list(),
    staleTime: 1000 * 30
  });
}
