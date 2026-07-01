import type { Database, GroupBalanceRow } from "@baki/db";

import { requiredTimestamp } from "../mappers";
import { watermelonTables } from "../tables";
import {
  readLocalExpenseRows,
  readLocalExpenseShares,
  type LocalExpenseRaw,
  type LocalExpenseShareRaw
} from "./expenses";
import { fetchLocalRows, upsertLocalRows } from "./shared";

export type SettlementRow = Database["public"]["Tables"]["settlements"]["Row"];

export type LocalSettlementRaw = {
  amount_paisa: number;
  client_mutation_id: string | null;
  external_ref: string | null;
  from_user: string;
  group_id: string;
  id: string;
  method: string;
  occurred_at: number;
  sync_status: string | null;
  to_user: string;
  updated_at: number | null;
};

export function mapSettlementRowToLocal(row: SettlementRow): LocalSettlementRaw {
  return {
    amount_paisa: row.amount_paisa,
    client_mutation_id: row.client_mutation_id,
    external_ref: row.external_ref,
    from_user: row.from_user,
    group_id: row.group_id,
    id: row.id,
    method: row.method,
    occurred_at: requiredTimestamp(row.occurred_at),
    sync_status: null,
    to_user: row.to_user,
    updated_at: requiredTimestamp(row.created_at)
  };
}

export function computeBalancesFromLocalRows({
  expenseShares,
  expenses,
  settlements
}: {
  expenseShares: readonly LocalExpenseShareRaw[];
  expenses: readonly LocalExpenseRaw[];
  settlements: readonly LocalSettlementRaw[];
}): GroupBalanceRow[] {
  const netByUser = new Map<string, number>();
  const activeExpenseIds = new Set<string>();

  const addNet = (userId: string, amountPaisa: number) => {
    netByUser.set(userId, (netByUser.get(userId) ?? 0) + amountPaisa);
  };

  for (const expense of expenses) {
    if (expense.deleted_at !== null) {
      continue;
    }

    activeExpenseIds.add(expense.id);
    addNet(expense.paid_by, expense.amount_paisa);
  }

  for (const share of expenseShares) {
    if (activeExpenseIds.has(share.expense_id)) {
      addNet(share.user_id, -share.share_paisa);
    }
  }

  for (const settlement of settlements) {
    addNet(settlement.from_user, settlement.amount_paisa);
    addNet(settlement.to_user, -settlement.amount_paisa);
  }

  return Array.from(netByUser.entries())
    .filter(([, netPaisa]) => netPaisa !== 0)
    .map(([userId, netPaisa]) => ({
      net_paisa: netPaisa,
      user_id: userId
    }))
    .sort((a, b) => b.net_paisa - a.net_paisa || a.user_id.localeCompare(b.user_id));
}

export async function readLocalSettlements(groupId: string): Promise<LocalSettlementRaw[]> {
  const rows = await fetchLocalRows<LocalSettlementRaw>(watermelonTables.settlements);
  return rows.filter((row) => row.group_id === groupId);
}

export async function computeLocalGroupBalances(groupId: string): Promise<GroupBalanceRow[]> {
  const [expenses, expenseShares, settlements] = await Promise.all([
    readLocalExpenseRows(groupId),
    readLocalExpenseShares(groupId),
    readLocalSettlements(groupId)
  ]);

  return computeBalancesFromLocalRows({ expenseShares, expenses, settlements });
}

export async function hasLocalLedgerRows(groupId: string): Promise<boolean> {
  const [expenses, settlements] = await Promise.all([
    readLocalExpenseRows(groupId),
    readLocalSettlements(groupId)
  ]);

  return expenses.length > 0 || settlements.length > 0;
}

export async function upsertRemoteSettlements(rows: readonly SettlementRow[]) {
  await upsertLocalRows(watermelonTables.settlements, rows.map(mapSettlementRowToLocal));
}
