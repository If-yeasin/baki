import type { Database } from "@baki/db";

import {
  isGroupTemplate,
  type GroupMemberRow,
  type GroupRow,
  type GroupSummary
} from "../../features/groups/types";

import { fromWatermelonTimestamp, requiredTimestamp, toWatermelonTimestamp } from "../mappers";
import { watermelonTables } from "../tables";
import { fetchLocalRows, upsertLocalRows } from "./shared";

type LocalGroupRaw = {
  archived_at: number | null;
  created_by: string;
  deleted_at: number | null;
  id: string;
  invite_code: string | null;
  name: string;
  template: string;
  updated_at: number;
};

type LocalGroupMemberRaw = {
  group_id: string;
  id: string;
  joined_at: number;
  left_at: number | null;
  role: string;
  user_id: string;
};

export type LocalGroupMemberSummary = {
  joinedAt: string;
  leftAt: string | null;
  role: string;
  userId: string;
};

export function mapGroupRowToLocal(row: GroupRow): LocalGroupRaw {
  return {
    archived_at: toWatermelonTimestamp(row.archived_at),
    created_by: row.created_by,
    deleted_at: toWatermelonTimestamp(row.deleted_at),
    id: row.id,
    invite_code: row.invite_code,
    name: row.name,
    template: row.template,
    updated_at: requiredTimestamp(row.updated_at)
  };
}

export function mapGroupMemberRowToLocal(row: GroupMemberRow): LocalGroupMemberRaw {
  return {
    group_id: row.group_id,
    id: `${row.group_id}:${row.user_id}`,
    joined_at: requiredTimestamp(row.joined_at),
    left_at: toWatermelonTimestamp(row.left_at),
    role: row.role,
    user_id: row.user_id
  };
}

export function mapLocalGroupToSummary(row: LocalGroupRaw): GroupSummary {
  return {
    archivedAt: fromWatermelonTimestamp(row.archived_at),
    createdBy: row.created_by,
    id: row.id,
    inviteCode: row.invite_code ?? "",
    name: row.name,
    template: isGroupTemplate(row.template) ? row.template : "custom",
    updatedAt: fromWatermelonTimestamp(row.updated_at) ?? new Date(0).toISOString()
  };
}

export async function readLocalGroups(): Promise<GroupSummary[]> {
  const rows = await fetchLocalRows<LocalGroupRaw>(watermelonTables.groups);

  return rows
    .filter((row) => row.deleted_at === null)
    .sort((a, b) => b.updated_at - a.updated_at)
    .map(mapLocalGroupToSummary);
}

export async function readLocalGroup(groupId: string): Promise<GroupSummary | null> {
  const rows = await fetchLocalRows<LocalGroupRaw>(watermelonTables.groups);
  const row = rows.find((group) => group.id === groupId && group.deleted_at === null);

  return row ? mapLocalGroupToSummary(row) : null;
}

export async function readLocalGroupMembers(groupId: string): Promise<LocalGroupMemberSummary[]> {
  const rows = await fetchLocalRows<LocalGroupMemberRaw>(watermelonTables.groupMembers);

  return rows
    .filter((row) => row.group_id === groupId)
    .sort((a, b) => a.joined_at - b.joined_at)
    .map((row) => ({
      joinedAt: fromWatermelonTimestamp(row.joined_at) ?? new Date(0).toISOString(),
      leftAt: fromWatermelonTimestamp(row.left_at),
      role: row.role,
      userId: row.user_id
    }));
}

export async function upsertRemoteGroups(rows: readonly GroupRow[]) {
  await upsertLocalRows(watermelonTables.groups, rows.map(mapGroupRowToLocal));
}

export async function upsertRemoteGroupMembers(rows: readonly GroupMemberRow[]) {
  await upsertLocalRows(watermelonTables.groupMembers, rows.map(mapGroupMemberRowToLocal));
}

export type ProfileJoinMemberRow = Database["public"]["Tables"]["group_members"]["Row"] & {
  profiles?: { display_name: string } | { display_name: string }[] | null;
};
