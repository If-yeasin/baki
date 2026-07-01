import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: vi.fn()
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn()
  }
}));

vi.mock("@/watermelon/repositories/activity", () => ({
  readLocalActivityRows: vi.fn(),
  upsertRemoteActivityRows: vi.fn()
}));

import { mapActivityRowsToItems } from "./use-activity-log";
import type { ActivityLogRow } from "@/watermelon/repositories/activity";

describe("mapActivityRowsToItems", () => {
  it("maps settlement payload details", () => {
    const [item] = mapActivityRowsToItems({
      actorNames: new Map([["tanvir", "Tanvir"]]),
      rows: [
        {
          actor_id: "tanvir",
          created_at: "2026-07-01T00:00:00.000Z",
          event_type: "settled",
          group_id: "group",
          id: "activity-1",
          payload: {
            amount_paisa: 1200,
            from_user: "tanvir",
            method: "bkash",
            settlement_id: "settlement-1",
            to_user: "rini"
          }
        }
      ] satisfies ActivityLogRow[],
      unknownName: "Unknown"
    });

    expect(item).toMatchObject({
      actorName: "Tanvir",
      amountPaisa: 1200,
      eventType: "settled",
      method: "bkash"
    });
  });

  it("falls back for missing actor names and unknown event types", () => {
    const [item] = mapActivityRowsToItems({
      actorNames: new Map(),
      rows: [
        {
          actor_id: "missing",
          created_at: "2026-07-01T00:00:00.000Z",
          event_type: "unexpected_event",
          group_id: "group",
          id: "activity-2",
          payload: {}
        }
      ] satisfies ActivityLogRow[],
      unknownName: "Unknown"
    });

    expect(item).toMatchObject({
      actorName: "Unknown",
      amountPaisa: null,
      eventType: "expense_edited",
      method: null
    });
  });
});
