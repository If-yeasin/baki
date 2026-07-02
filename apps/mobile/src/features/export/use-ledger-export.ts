import { useMutation } from "@tanstack/react-query";
import { Share } from "react-native";

import { buildGroupLedgerCsv, loadGroupLedgerCsvData } from "./group-ledger-csv";

export type ShareLedgerCsvInput = {
  groupId: string;
};

export type ShareLedgerCsvResult = {
  rowCount: number;
};

function buildExportTitle(groupName: string) {
  const safeName = groupName.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "");
  return `${safeName || "baki-ledger"}.csv`;
}

export async function shareGroupLedgerCsv({
  groupId
}: ShareLedgerCsvInput): Promise<ShareLedgerCsvResult> {
  const data = await loadGroupLedgerCsvData(groupId);
  const csv = buildGroupLedgerCsv(data);
  const title = buildExportTitle(data.groupName);

  await Share.share({
    message: csv,
    title
  });

  return { rowCount: data.rowCount };
}

export function useShareGroupLedgerCsv() {
  return useMutation({
    mutationFn: shareGroupLedgerCsv
  });
}
