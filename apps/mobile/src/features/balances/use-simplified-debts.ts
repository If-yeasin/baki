import type { Database } from "@baki/db";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { GroupBalanceRow } from "@baki/db";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

export type SimplifiedDebtRow =
  Database["public"]["Functions"]["simplify_debts"]["Returns"][number];

export type UserSettlementTransfer = {
  amountPaisa: number;
  counterpartyId: string;
  direction: "pay" | "receive";
  fromUser: string;
  toUser: string;
};

export const simplifiedDebtsKeys = {
  all: ["simplified-debts"] as const,
  group: (groupId: string) => [...simplifiedDebtsKeys.all, "group", groupId] as const
};

export function buildUserSettlementPlan(
  rows: readonly SimplifiedDebtRow[],
  currentUserId: string
): UserSettlementTransfer[] {
  return rows
    .filter((row) => row.from_user === currentUserId || row.to_user === currentUserId)
    .map((row) => ({
      amountPaisa: row.amount_paisa,
      counterpartyId: row.from_user === currentUserId ? row.to_user : row.from_user,
      direction: row.from_user === currentUserId ? "pay" : "receive",
      fromUser: row.from_user,
      toUser: row.to_user
    }));
}

export function buildRawBalanceFallbackPlan(
  balances: readonly GroupBalanceRow[],
  currentUserId: string
): UserSettlementTransfer[] {
  const selfRow = balances.find((row) => row.user_id === currentUserId);
  if (!selfRow || selfRow.net_paisa >= 0) return [];

  const creditorRows = balances.filter((row) => row.user_id !== currentUserId && row.net_paisa > 0);
  const totalCredit = creditorRows.reduce((sum, row) => sum + row.net_paisa, 0);
  if (totalCredit <= 0) return [];

  const selfDebt = -selfRow.net_paisa;
  const selfDebtPaisa = BigInt(selfDebt);
  const totalCreditPaisa = BigInt(totalCredit);
  const draft = creditorRows.map((row) => ({
    amountPaisa: Number((BigInt(row.net_paisa) * selfDebtPaisa) / totalCreditPaisa),
    counterpartyId: row.user_id,
    credit: row.net_paisa,
    direction: "pay" as const,
    fromUser: currentUserId,
    toUser: row.user_id
  }));

  const allocated = draft.reduce((sum, row) => sum + row.amountPaisa, 0);
  const remainder = selfDebt - allocated;
  if (remainder > 0 && draft.length > 0) {
    let largestIdx = 0;
    for (let i = 1; i < draft.length; i++) {
      const candidate = draft[i];
      const current = draft[largestIdx];
      if (candidate && current && candidate.credit > current.credit) largestIdx = i;
    }
    const target = draft[largestIdx];
    if (target) target.amountPaisa += remainder;
  }

  return draft.map(({ credit: _credit, ...row }) => row);
}

async function fetchSimplifiedDebts(groupId: string): Promise<SimplifiedDebtRow[]> {
  const { data, error } = await supabase.rpc("simplify_debts", {
    p_group_id: groupId
  });

  if (error) {
    Sentry.captureException(error, { tags: { feature: "balances.simplify_debts" } });
    throw error;
  }

  return data ?? [];
}

export function useSimplifiedDebts(groupId: string | undefined) {
  return useQuery({
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchSimplifiedDebts(groupId as string),
    queryKey: groupId
      ? simplifiedDebtsKeys.group(groupId)
      : ["simplified-debts", "group", "unknown"],
    retry: 1,
    staleTime: 1000 * 60
  });
}
