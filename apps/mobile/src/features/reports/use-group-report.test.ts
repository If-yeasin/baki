import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sentry", () => ({
  Sentry: { captureException: vi.fn() }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() }
}));

vi.mock("@/watermelon/repositories/balances", () => ({
  readLocalSettlements: vi.fn(),
  upsertRemoteSettlements: vi.fn()
}));

import {
  fetchGroupReportSettlements,
  mapLocalSettlementToReportSettlement,
  mapSettlementRowToReportSettlement
} from "./use-group-report";
import { supabase } from "@/lib/supabase";
import { readLocalSettlements } from "@/watermelon/repositories/balances";

const safeSettlementColumns = "id, amount_paisa, from_user, to_user, method, occurred_at";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("report settlement mapping", () => {
  it("maps remote settlement rows without exposing external references", () => {
    expect(
      mapSettlementRowToReportSettlement({
        amount_paisa: 45_000,
        client_mutation_id: "mutation-1",
        created_at: "2026-06-20T12:00:00.000Z",
        external_ref: "SHOULD_NOT_LEAK",
        from_user: "rini",
        group_id: "group-1",
        id: "settlement-1",
        method: "bkash",
        occurred_at: "2026-06-20T12:00:00.000Z",
        to_user: "tanvir"
      })
    ).toEqual({
      amountPaisa: 45_000,
      fromUser: "rini",
      id: "settlement-1",
      method: "bkash",
      occurredAt: "2026-06-20T12:00:00.000Z",
      toUser: "tanvir"
    });
  });

  it("maps local settlement rows from Watermelon timestamps", () => {
    expect(
      mapLocalSettlementToReportSettlement({
        amount_paisa: 12_500,
        client_mutation_id: null,
        external_ref: "LOCAL_REF_SHOULD_NOT_LEAK",
        from_user: "sadman",
        group_id: "group-1",
        id: "settlement-local",
        method: "cash",
        occurred_at: Date.parse("2026-06-21T12:00:00.000Z"),
        sync_status: null,
        to_user: "rini",
        updated_at: null
      })
    ).toEqual({
      amountPaisa: 12_500,
      fromUser: "sadman",
      id: "settlement-local",
      method: "cash",
      occurredAt: "2026-06-21T12:00:00.000Z",
      toUser: "rini"
    });
  });

  it("fetches only report-safe settlement columns and merges unsynced local rows", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          amount_paisa: 45_000,
          from_user: "rini",
          id: "settlement-remote",
          method: "bkash",
          occurred_at: "2026-06-20T12:00:00.000Z",
          to_user: "tanvir"
        }
      ],
      error: null
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    vi.mocked(supabase.from).mockReturnValue({ select } as never);
    vi.mocked(readLocalSettlements).mockResolvedValue([
      {
        amount_paisa: 45_000,
        client_mutation_id: null,
        external_ref: "LOCAL_DUPLICATE_REF_SHOULD_NOT_LEAK",
        from_user: "rini",
        group_id: "group-1",
        id: "settlement-remote",
        method: "bkash",
        occurred_at: Date.parse("2026-06-20T12:00:00.000Z"),
        sync_status: null,
        to_user: "tanvir",
        updated_at: null
      },
      {
        amount_paisa: 15_000,
        client_mutation_id: "queued-local",
        external_ref: "LOCAL_UNSYNCED_REF_SHOULD_NOT_LEAK",
        from_user: "tanvir",
        group_id: "group-1",
        id: "settlement-local",
        method: "cash",
        occurred_at: Date.parse("2026-06-21T12:00:00.000Z"),
        sync_status: "pending",
        to_user: "rini",
        updated_at: null
      }
    ]);

    await expect(fetchGroupReportSettlements("group-1")).resolves.toEqual([
      {
        amountPaisa: 45_000,
        fromUser: "rini",
        id: "settlement-remote",
        method: "bkash",
        occurredAt: "2026-06-20T12:00:00.000Z",
        toUser: "tanvir"
      },
      {
        amountPaisa: 15_000,
        fromUser: "tanvir",
        id: "settlement-local",
        method: "cash",
        occurredAt: "2026-06-21T12:00:00.000Z",
        toUser: "rini"
      }
    ]);
    expect(select).toHaveBeenCalledWith(safeSettlementColumns);
  });
});
