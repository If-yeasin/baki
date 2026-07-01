import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/activity/use-activity-log", () => ({
  activityKeys: {
    group: (groupId: string) => ["activity", "group", groupId]
  }
}));

vi.mock("@/features/balances/use-balances", () => ({
  balancesKeys: {
    group: (groupId: string) => ["balances", "group", groupId]
  }
}));

vi.mock("@/features/balances/use-simplified-debts", () => ({
  simplifiedDebtsKeys: {
    group: (groupId: string) => ["simplified-debts", "group", groupId]
  }
}));

vi.mock("@/features/expenses/use-expenses", () => ({
  expensesKeys: {
    list: (groupId: string) => ["expenses", "list", groupId]
  }
}));

vi.mock("@/features/offline/mutation-queue", () => ({
  enqueueMutation: vi.fn()
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: vi.fn()
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

import { buildCreateSettlementRpcPayload } from "./use-create-settlement";

describe("buildCreateSettlementRpcPayload", () => {
  it("preserves an existing client mutation id for retry-safe settlement writes", () => {
    expect(
      buildCreateSettlementRpcPayload({
        amountPaisa: 1250,
        clientMutationId: " settlement:test-id ",
        externalRef: "cash-note",
        fromUser: "tanvir",
        groupId: "group-1",
        method: "cash",
        toUser: "rini"
      })
    ).toEqual({
      p_amount_paisa: 1250,
      p_client_mutation_id: "settlement:test-id",
      p_external_ref: "cash-note",
      p_from_user: "tanvir",
      p_group_id: "group-1",
      p_method: "cash",
      p_to_user: "rini"
    });
  });
});
