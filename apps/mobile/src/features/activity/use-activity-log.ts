import type { Json } from "@baki/db";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

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
  | "group_archived"
  | "group_created"
  | "group_deleted"
  | "group_renamed"
  | "group_template_changed"
  | "invite_regenerated";

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
  group: (groupId: string) => [...activityKeys.all, "group", groupId] as const,
  groupPage: (groupId: string, limit: number) =>
    [...activityKeys.group(groupId), "page", limit] as const
};

const activityEventTypes = new Set<ActivityEventType>([
  "expense_added",
  "expense_edited",
  "expense_deleted",
  "settled",
  "member_joined",
  "member_left",
  "group_archived",
  "group_created",
  "group_deleted",
  "group_renamed",
  "group_template_changed",
  "invite_regenerated"
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

export type ActivityLogPage = {
  items: ActivityLogItem[];
  nextCursor: string | null;
};

export async function fetchGroupActivityPage({
  cursor,
  groupId,
  limit = 50,
  unknownName = "Unknown user"
}: {
  cursor?: string | null;
  groupId: string;
  limit?: number;
  unknownName?: string;
}): Promise<ActivityLogPage> {
  const localRows = await readLocalActivityRows(groupId);

  try {
    let query = supabase
      .from("activity_log")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    const visibleRows = rows.slice(0, limit);
    await upsertRemoteActivityRows(visibleRows);
    return {
      items: await hydrateActivityActors(visibleRows, unknownName),
      nextCursor: rows.length > limit ? (visibleRows.at(-1)?.created_at ?? null) : null
    };
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "activity.group" } });
    if (!cursor && localRows.length > 0) {
      const rows = localRows.slice(0, limit);
      return {
        items: await hydrateActivityActors(rows, unknownName),
        nextCursor: localRows.length > limit ? (rows.at(-1)?.created_at ?? null) : null
      };
    }
    throw error;
  }
}

export async function fetchGroupActivity(
  groupId: string,
  options: { limit?: number; unknownName?: string } = {}
): Promise<ActivityLogItem[]> {
  const page = await fetchGroupActivityPage({
    groupId,
    limit: options.limit,
    unknownName: options.unknownName
  });
  return page.items;
}

async function hydrateActivityActors(
  rows: readonly ActivityLogRow[],
  unknownName: string
): Promise<ActivityLogItem[]> {
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
    unknownName
  });
}

export function useGroupActivity(groupId: string | undefined, unknownName?: string) {
  return useQuery({
    enabled: Boolean(groupId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchGroupActivity(groupId as string, { unknownName }),
    queryKey: groupId ? activityKeys.group(groupId) : ["activity", "group", "unknown"],
    staleTime: 1000 * 30
  });
}

export function useInfiniteGroupActivity(groupId: string | undefined, unknownName: string) {
  return useInfiniteQuery<ActivityLogPage, Error>({
    enabled: Boolean(groupId),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchGroupActivityPage({
        cursor: pageParam as string | null,
        groupId: groupId as string,
        limit: 25,
        unknownName
      }),
    queryKey: groupId ? [...activityKeys.group(groupId), "infinite"] : ["activity", "group", "infinite", "unknown"],
    staleTime: 1000 * 30
  });
}
