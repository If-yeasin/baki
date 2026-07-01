import type { Database, Json } from "@baki/db";

import { fromWatermelonTimestamp, requiredTimestamp } from "../mappers";
import { watermelonTables } from "../tables";
import { fetchLocalRows, upsertLocalRows } from "./shared";

export type ActivityLogRow = Database["public"]["Tables"]["activity_log"]["Row"];

export type LocalActivityLogRaw = {
  actor_id: string;
  created_at: number;
  event_type: string;
  group_id: string;
  id: string;
  payload: string;
};

export function mapActivityRowToLocal(row: ActivityLogRow): LocalActivityLogRaw {
  return {
    actor_id: row.actor_id,
    created_at: requiredTimestamp(row.created_at),
    event_type: row.event_type,
    group_id: row.group_id,
    id: row.id,
    payload: JSON.stringify(row.payload ?? {})
  };
}

export function mapLocalActivityToRow(row: LocalActivityLogRaw): ActivityLogRow {
  let payload: Json = {};

  try {
    payload = JSON.parse(row.payload) as Json;
  } catch {
    payload = {};
  }

  return {
    actor_id: row.actor_id,
    created_at: fromWatermelonTimestamp(row.created_at) ?? new Date(0).toISOString(),
    event_type: row.event_type,
    group_id: row.group_id,
    id: row.id,
    payload
  };
}

export async function readLocalActivityRows(groupId: string): Promise<ActivityLogRow[]> {
  const rows = await fetchLocalRows<LocalActivityLogRaw>(watermelonTables.activityLog);

  return rows
    .filter((row) => row.group_id === groupId)
    .sort((a, b) => b.created_at - a.created_at)
    .map(mapLocalActivityToRow);
}

export async function upsertRemoteActivityRows(rows: readonly ActivityLogRow[]) {
  await upsertLocalRows(watermelonTables.activityLog, rows.map(mapActivityRowToLocal));
}
