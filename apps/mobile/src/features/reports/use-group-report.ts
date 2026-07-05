import type { Database } from "@baki/db";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import {
  readLocalSettlements,
  type LocalSettlementRaw
} from "@/watermelon/repositories/balances";

import type { ReportSettlement } from "./group-report";

type SettlementRow = Database["public"]["Tables"]["settlements"]["Row"];
type ReportSettlementRow = Pick<
  SettlementRow,
  "amount_paisa" | "from_user" | "id" | "method" | "occurred_at" | "to_user"
> &
  Partial<Pick<SettlementRow, "client_mutation_id" | "created_at" | "external_ref" | "group_id">>;

export const reportSettlementColumns = "id, amount_paisa, from_user, to_user, method, occurred_at";

export const reportKeys = {
  all: ["reports"] as const,
  settlements: (groupId: string) => [...reportKeys.all, "settlements", groupId] as const
};

export function mapSettlementRowToReportSettlement(row: ReportSettlementRow): ReportSettlement {
  return {
    amountPaisa: row.amount_paisa,
    fromUser: row.from_user,
    id: row.id,
    method: row.method,
    occurredAt: row.occurred_at,
    toUser: row.to_user
  };
}

export function mapLocalSettlementToReportSettlement(row: LocalSettlementRaw): ReportSettlement {
  return {
    amountPaisa: row.amount_paisa,
    fromUser: row.from_user,
    id: row.id,
    method: row.method,
    occurredAt: new Date(row.occurred_at).toISOString(),
    toUser: row.to_user
  };
}

function mergeReportSettlements(
  remoteSettlements: readonly ReportSettlement[],
  localSettlements: readonly ReportSettlement[]
): ReportSettlement[] {
  const remoteIds = new Set(remoteSettlements.map((settlement) => settlement.id));
  return [
    ...remoteSettlements,
    ...localSettlements.filter((settlement) => !remoteIds.has(settlement.id))
  ];
}

export async function fetchGroupReportSettlements(groupId: string): Promise<ReportSettlement[]> {
  const localSettlements = (await readLocalSettlements(groupId)).map(mapLocalSettlementToReportSettlement);

  try {
    const { data, error } = await supabase
      .from("settlements")
      .select(reportSettlementColumns)
      .eq("group_id", groupId)
      .order("occurred_at", { ascending: false });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as ReportSettlementRow[];
    return mergeReportSettlements(rows.map(mapSettlementRowToReportSettlement), localSettlements);
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "reports.settlements" } });
    return localSettlements;
  }
}

export function useGroupReportSettlements(groupId: string | undefined) {
  return useQuery({
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchGroupReportSettlements(groupId as string),
    queryKey: groupId ? reportKeys.settlements(groupId) : ["reports", "settlements", "unknown"]
  });
}
