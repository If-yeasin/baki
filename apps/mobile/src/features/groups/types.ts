import type { Database } from "@baki/db";

export type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
export type GroupInsert = Database["public"]["Tables"]["groups"]["Insert"];
export type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];

export type GroupTemplate = "mess" | "family" | "trip" | "event" | "custom";

export const GROUP_TEMPLATES: readonly GroupTemplate[] = [
  "mess",
  "family",
  "trip",
  "event",
  "custom"
] as const;

/**
 * Fallback display name when a member row has no associated profile yet
 * (e.g. invite accepted before the profile row hydrated). Rendered as-is,
 * since this fallback runs at the data layer outside of i18n context.
 */
export const UNKNOWN_DISPLAY_NAME = "অজানা";

export function isGroupTemplate(value: string): value is GroupTemplate {
  return (GROUP_TEMPLATES as readonly string[]).includes(value);
}

export type GroupSummary = {
  archivedAt: string | null;
  createdAt: string;
  createdBy: string;
  id: string;
  inviteCode: string;
  name: string;
  template: GroupTemplate;
  updatedAt: string;
};

export function toGroupSummary(row: GroupRow): GroupSummary {
  return {
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
    id: row.id,
    inviteCode: row.invite_code,
    name: row.name,
    template: isGroupTemplate(row.template) ? row.template : "custom",
    updatedAt: row.updated_at
  };
}
