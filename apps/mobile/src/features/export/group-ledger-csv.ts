import type { Database } from "@baki/db";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import { fetchGroupDetail } from "@/features/groups/use-group-detail";
import {
  readLocalExpenseRows,
  readLocalExpenseShares,
  upsertRemoteExpenses,
  upsertRemoteExpenseShares,
  type ExpenseShareRow,
  type LocalExpenseRaw,
  type LocalExpenseShareRaw
} from "@/watermelon/repositories/expenses";

type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];

export type LedgerCsvExpense = Pick<
  ExpenseRow,
  "amount_paisa" | "category" | "description" | "id" | "occurred_at" | "paid_by" | "split_method"
>;

export type LedgerCsvShare = Pick<ExpenseShareRow, "expense_id" | "share_paisa" | "user_id">;

export type LedgerCsvInput = {
  expenses: readonly LedgerCsvExpense[];
  groupName: string;
  members: ReadonlyMap<string, string>;
  shares: readonly LedgerCsvShare[];
};

export type LedgerCsvLoadResult = LedgerCsvInput & {
  rowCount: number;
};

const csvHeaders = [
  "group_name",
  "expense_id",
  "expense_date",
  "description",
  "category",
  "paid_by",
  "amount_paisa",
  "amount_bdt",
  "split_method",
  "member_name",
  "member_share_paisa",
  "member_share_bdt"
] as const;

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const rendered = String(value);
  if (!/[",\n\r]/.test(rendered)) {
    return rendered;
  }

  return `"${rendered.replaceAll('"', '""')}"`;
}

function formatBdtFromPaisa(value: number): string {
  return (value / 100).toFixed(2);
}

export function buildGroupLedgerCsv(input: LedgerCsvInput): string {
  const sharesByExpense = new Map<string, LedgerCsvShare[]>();
  for (const share of input.shares) {
    const existing = sharesByExpense.get(share.expense_id) ?? [];
    existing.push(share);
    sharesByExpense.set(share.expense_id, existing);
  }

  const rows = input.expenses.flatMap((expense) => {
    const shares = sharesByExpense.get(expense.id) ?? [];
    const renderedShares = shares.length > 0 ? shares : [null];

    return renderedShares.map((share) => [
      input.groupName,
      expense.id,
      expense.occurred_at,
      expense.description,
      expense.category,
      input.members.get(expense.paid_by) ?? expense.paid_by,
      expense.amount_paisa,
      formatBdtFromPaisa(expense.amount_paisa),
      expense.split_method,
      share ? (input.members.get(share.user_id) ?? share.user_id) : "",
      share?.share_paisa ?? "",
      share ? formatBdtFromPaisa(share.share_paisa) : ""
    ]);
  });

  return [csvHeaders, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

export async function loadGroupLedgerCsvData(groupId: string): Promise<LedgerCsvLoadResult> {
  const detail = await fetchGroupDetail(groupId);
  const members = new Map(detail.members.map((member) => [member.userId, member.displayName]));

  try {
    const { data: expenses, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false });

    if (error) {
      throw error;
    }

    const expenseRows = expenses ?? [];
    const expenseIds = expenseRows.map((expense) => expense.id);
    const sharesResult =
      expenseIds.length > 0
        ? await supabase.from("expense_shares").select("*").in("expense_id", expenseIds)
        : { data: [], error: null };

    if (sharesResult.error) {
      throw sharesResult.error;
    }

    await Promise.all([
      upsertRemoteExpenses(expenseRows),
      upsertRemoteExpenseShares(sharesResult.data ?? [])
    ]);

    return {
      expenses: expenseRows,
      groupName: detail.group.name,
      members,
      rowCount: Math.max(sharesResult.data?.length ?? 0, expenseRows.length),
      shares: sharesResult.data ?? []
    };
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "export.groupLedger" } });

    const [localExpenses, localShares] = await Promise.all([
      readLocalExpenseRows(groupId),
      readLocalExpenseShares(groupId)
    ]);

    return {
      expenses: localExpenses.map(mapLocalExpenseToCsvExpense),
      groupName: detail.group.name,
      members,
      rowCount: Math.max(localShares.length, localExpenses.length),
      shares: localShares.map(mapLocalShareToCsvShare)
    };
  }
}

function mapLocalExpenseToCsvExpense(row: LocalExpenseRaw): LedgerCsvExpense {
  return {
    amount_paisa: row.amount_paisa,
    category: row.category,
    description: row.description,
    id: row.id,
    occurred_at: new Date(row.occurred_at).toISOString(),
    paid_by: row.paid_by,
    split_method: row.split_method
  };
}

function mapLocalShareToCsvShare(row: LocalExpenseShareRaw): LedgerCsvShare {
  return {
    expense_id: row.expense_id,
    share_paisa: row.share_paisa,
    user_id: row.user_id
  };
}
