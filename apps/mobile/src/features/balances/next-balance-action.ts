import type { GroupBalanceRow } from "@baki/db";
import { formatMoney, type AppLocale } from "@baki/i18n";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type BalanceActionGroup = {
  id: string;
  name: string;
};

export type BalanceCounterpartyProfile = {
  display_name: string;
  id: string;
};

export type NextBalanceAction = {
  actionLabel: string;
  amountLabel: string;
  groupId: string;
  subtitle: string;
  title: string;
  tone: "negative" | "positive";
};

export function pickCounterparty(
  rows: GroupBalanceRow[],
  selfId: string | null,
  selfNet: number
): GroupBalanceRow | null {
  if (!selfId || selfNet === 0) return null;

  const candidates = rows
    .filter((row) => {
      if (row.user_id === selfId) return false;
      return selfNet < 0 ? row.net_paisa > 0 : row.net_paisa < 0;
    })
    .sort((a, b) => Math.abs(b.net_paisa) - Math.abs(a.net_paisa));

  return candidates[0] ?? null;
}

export function getCounterpartyIds({
  balanceRowsByGroup,
  groups,
  selfId
}: {
  balanceRowsByGroup: GroupBalanceRow[][];
  groups: BalanceActionGroup[];
  selfId: string | null;
}): string[] {
  return Array.from(
    new Set(
      groups.flatMap((_group, index) => {
        const rows = balanceRowsByGroup[index] ?? [];
        const selfRow = selfId ? rows.find((row) => row.user_id === selfId) : undefined;
        const counterparty = pickCounterparty(rows, selfId, selfRow?.net_paisa ?? 0);
        return counterparty ? [counterparty.user_id] : [];
      })
    )
  ).sort();
}

export function buildNextBalanceAction({
  balanceRowsByGroup,
  groups,
  locale,
  perGroupNets,
  profileNameById,
  selfId,
  t
}: {
  balanceRowsByGroup: GroupBalanceRow[][];
  groups: BalanceActionGroup[];
  locale: AppLocale;
  perGroupNets: number[];
  profileNameById: Map<string, string>;
  selfId: string | null;
  t: Translate;
}): NextBalanceAction | null {
  const prioritized = groups
    .map((group, index) => ({ group, index, net: perGroupNets[index] ?? 0 }))
    .filter((item) => item.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  for (const { group, index, net } of prioritized) {
    const rows = balanceRowsByGroup[index] ?? [];
    const counterparty = pickCounterparty(rows, selfId, net);
    const counterpartyName = counterparty
      ? (profileNameById.get(counterparty.user_id) ?? t("common.unknown_user"))
      : group.name;
    const isDebt = net < 0;
    const hasSpecificCounterparty = Boolean(counterparty);

    return {
      actionLabel: isDebt ? t("balances.next.action.settle") : t("balances.next.action.view"),
      amountLabel: formatMoney(Math.abs(net), locale),
      groupId: group.id,
      subtitle: t("balances.next.subtitle", {
        group: group.name,
        status: t(isDebt ? "balance.you_owe" : "balance.you_are_owed")
      }),
      title: hasSpecificCounterparty
        ? t(isDebt ? "balances.next.payPerson" : "balances.next.collectPerson", {
            name: counterpartyName
          })
        : t(isDebt ? "balances.next.payGroup" : "balances.next.collectGroup", {
            name: group.name
          }),
      tone: isDebt ? "negative" : "positive"
    };
  }

  return null;
}
