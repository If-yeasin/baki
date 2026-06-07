import type { GroupBalanceRow } from "@baki/db";

/**
 * Display props for a per-row balance pill in a group view.
 *
 * `netPaisa` is the signed paisa amount from the caller's perspective:
 *   netPaisa > 0  -> caller is owed this much by `counterpartyName`
 *   netPaisa < 0  -> caller owes this much to `counterpartyName`
 *   netPaisa = 0  -> nothing outstanding with `counterpartyName`
 */
export type BalanceDisplayRow = {
  counterpartyId: string;
  counterpartyName: string;
  netPaisa: number;
};

export type SelfBalanceSummary = {
  /** Caller's signed net for the entire group. */
  netPaisa: number;
  /** Rows for everybody other than the caller, ordered: owed-first, then owing, then settled. */
  rows: BalanceDisplayRow[];
};

export type DisplayMemberLookup = (userId: string) => string | undefined;

/**
 * Project the raw `get_group_balances` rows into something a screen can
 * render. The RPC already returns each member's signed net for the group;
 * to derive caller-vs-other pairs without re-running the simplifier we use
 * a "owe-the-pool" model: anyone with a positive net is a creditor, anyone
 * with a negative net is a debtor, and we display each non-self row from
 * the caller's perspective.
 *
 * For the *aggregate* number we display the caller's own row from the RPC
 * directly. For per-counterparty rows we display the other side's amount
 * with the sign flipped — so "Tanvir is owed ৳450" becomes "You owe Tanvir
 * ৳450" when caller is in deficit, and vice versa. This is not the same
 * as the minimum-transaction settle plan (that's `simplify_debts`); it's
 * the obvious khata view.
 */
export function buildSelfBalanceSummary(
  rows: readonly GroupBalanceRow[],
  selfId: string,
  resolveName: DisplayMemberLookup,
  fallbackName: string
): SelfBalanceSummary {
  const selfRow = rows.find((row) => row.user_id === selfId);
  const selfNet = selfRow?.net_paisa ?? 0;

  const others = rows.filter((row) => row.user_id !== selfId);

  const displayRows: BalanceDisplayRow[] = others.map((row) => {
    // Flip the sign so the row is from the caller's perspective.
    const netPaisa = -row.net_paisa;

    return {
      counterpartyId: row.user_id,
      counterpartyName: resolveName(row.user_id) ?? fallbackName,
      netPaisa
    };
  });

  // Order: caller-owed first (positive desc), then caller-owes (negative asc by magnitude), then zeros.
  displayRows.sort((a, b) => {
    if (a.netPaisa === b.netPaisa) {
      return a.counterpartyName.localeCompare(b.counterpartyName);
    }

    if (a.netPaisa > 0 && b.netPaisa <= 0) return -1;
    if (b.netPaisa > 0 && a.netPaisa <= 0) return 1;

    if (a.netPaisa > 0 && b.netPaisa > 0) return b.netPaisa - a.netPaisa;
    if (a.netPaisa < 0 && b.netPaisa < 0) return a.netPaisa - b.netPaisa;

    return 0;
  });

  return {
    netPaisa: selfNet,
    rows: displayRows
  };
}

/**
 * Aggregate signed net across many groups (used by the "All groups"
 * balances tab). The argument is a list of per-group caller nets.
 */
export function sumSelfNets(perGroupNetPaisa: readonly number[]): number {
  return perGroupNetPaisa.reduce((acc, value) => acc + value, 0);
}
