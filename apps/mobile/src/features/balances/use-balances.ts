import type { GroupBalanceRow } from "@baki/db";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { storage } from "@/lib/mmkv";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

export const balancesKeys = {
  all: ["balances"] as const,
  group: (groupId: string) => [...balancesKeys.all, "group", groupId] as const
};

function balanceCacheKey(groupId: string): string {
  return `balances.cache.${groupId}`;
}

function readCachedBalances(groupId: string): GroupBalanceRow[] | null {
  const raw = storage.getString(balanceCacheKey(groupId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GroupBalanceRow[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function fetchGroupBalances(groupId: string): Promise<GroupBalanceRow[]> {
  try {
    const { data, error } = await supabase.rpc("get_group_balances", {
      p_group_id: groupId
    });

    if (error) {
      throw error;
    }

    const rows: GroupBalanceRow[] = data ?? [];
    storage.set(balanceCacheKey(groupId), JSON.stringify(rows));
    // TODO(offline-watermelon): compute balances locally from the cached
    // expenses + expense_shares + settlements tables when offline.
    // Persisted-cache fallback covers the gap until WatermelonDB hydration lands.
    return rows;
  } catch (error) {
    const cached = readCachedBalances(groupId);
    if (cached) {
      Sentry.captureException(error, {
        tags: { feature: "balances.cache_fallback" }
      });
      return cached;
    }
    throw error;
  }
}

export function useGroupBalances(groupId: string | undefined) {
  return useQuery({
    enabled: Boolean(groupId),
    gcTime: 1000 * 60 * 60,
    placeholderData: keepPreviousData,
    queryFn: () => fetchGroupBalances(groupId as string),
    queryKey: groupId ? balancesKeys.group(groupId) : ["balances", "group", "unknown"],
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 1000 * 60
  });
}
