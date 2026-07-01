import type { Json } from "@baki/db";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import {
  readLocalActivityRows,
  upsertRemoteActivityRows,
  type ActivityLogRow
} from "@/watermelon/repositories/activity";

export type ActivityEventType =
  | "expense_added"
  | "expense_edited"
  | "expense_deleted"
  | "settled"
  | "member_joined"
  | "member_left"
  | "group_renamed";

export type ActivityLogItem = {
  actorId: string;
  actorName: string;
  amountPaisa: number | null;
  createdAt: string;
  description: string | null;
  eventType: ActivityEventType;
  groupId: string;
  id: string;
  method: string | null;
};

export const activityKeys = {
  all: ["activity"] as const,
  group: (groupId: string) => [...activityKeys.all, "group", groupId] as const
};

const activityEventTypes = new Set<ActivityEventType>([
  "expense_added",
  "expense_edited",
  "expense_deleted",
  "settled",
  "member_joined",
  "member_left",
  "group_renamed"
]);

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPayloadNumber(payload: Json, key: string): number | null {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "number" ? value : null;
}

function readPayloadString(payload: Json, key: string): string | null {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

export function mapActivityRowsToItems({
  actorNames,
  rows,
  unknownName
}: {
  actorNames: ReadonlyMap<string, string>;
  rows: readonly ActivityLogRow[];
  unknownName: string;
}): ActivityLogItem[] {
  return rows.map((row) => ({
    actorId: row.actor_id,
    actorName: actorNames.get(row.actor_id) ?? unknownName,
    amountPaisa: readPayloadNumber(row.payload, "amount_paisa"),
    createdAt: row.created_at,
    description: readPayloadString(row.payload, "description"),
    eventType: activityEventTypes.has(row.event_type as ActivityEventType)
      ? (row.event_type as ActivityEventType)
      : "expense_edited",
    groupId: row.group_id,
    id: row.id,
    method: readPayloadString(row.payload, "method")
  }));
}

export async function fetchGroupActivity(groupId: string): Promise<ActivityLogItem[]> {
  const localRows = await readLocalActivityRows(groupId);

  try {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    await upsertRemoteActivityRows(rows);
    return hydrateActivityActors(rows);
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "activity.group" } });
    if (localRows.length > 0) {
      return hydrateActivityActors(localRows);
    }
    throw error;
  }
}

async function hydrateActivityActors(rows: readonly ActivityLogRow[]): Promise<ActivityLogItem[]> {
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id))).sort();
  const actorNames = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", actorIds);

    if (!error) {
      for (const profile of data ?? []) {
        actorNames.set(profile.id, profile.display_name);
      }
    }
  }

  return mapActivityRowsToItems({
    actorNames,
    rows,
    unknownName: "Unknown user"
  });
}

export function useGroupActivity(groupId: string | undefined) {
  return useQuery({
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchGroupActivity(groupId as string),
    queryKey: groupId ? activityKeys.group(groupId) : ["activity", "group", "unknown"],
    staleTime: 1000 * 30
  });
}
