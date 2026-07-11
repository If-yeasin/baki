import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  enqueueMoneyMutationFromRpcError: vi.fn(),
  getSession: vi.fn(),
  rpc: vi.fn()
}));

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
  enqueueMoneyMutationFromRpcError: mocks.enqueueMoneyMutationFromRpcError
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: mocks.captureException
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession
    },
    rpc: mocks.rpc
  }
}));

import {
  buildCreateSettlementRpcPayload,
  createSettlementWithOfflineQueue
} from "./use-create-settlement";

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

describe("createSettlementWithOfflineQueue", () => {
  const input = {
    amountPaisa: 1250,
    clientMutationId: " settlement:test-id ",
    externalRef: "cash-note",
    fromUser: "tanvir",
    groupId: "group-1",
    method: "cash" as const,
    toUser: "rini"
  };

  beforeEach(() => {
    mocks.captureException.mockReset();
    mocks.enqueueMoneyMutationFromRpcError.mockReset();
    mocks.getSession.mockReset();
    mocks.rpc.mockReset();
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "tanvir" } } },
      error: null
    });
  });

  it("returns queued success when a temporary RPC failure is queued", async () => {
    const error = new Error("Network request failed");
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.enqueueMoneyMutationFromRpcError.mockReturnValue({
      kind: "queued",
      queuedMutationId: "settlement.create:queued"
    });

    await expect(createSettlementWithOfflineQueue(input)).resolves.toEqual({
      queuedMutationId: "settlement.create:queued",
      status: "queued"
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_settlement", {
      p_amount_paisa: 1250,
      p_client_mutation_id: "settlement:test-id",
      p_external_ref: "cash-note",
      p_from_user: "tanvir",
      p_group_id: "group-1",
      p_method: "cash",
      p_to_user: "rini"
    });
    expect(mocks.enqueueMoneyMutationFromRpcError).toHaveBeenCalledWith({
      error,
      ownerUserId: "tanvir",
      payload: expect.objectContaining({
        p_client_mutation_id: "settlement:test-id"
      }),
      type: "settlement.create"
    });
    expect(mocks.captureException).toHaveBeenCalledWith(error, {
      tags: { feature: "settlement.create", phase: "rpc" }
    });
  });

  it("throws permanent RPC failures after keeping them visible in the queue", async () => {
    const error = { code: "42501", message: "not_group_member" };
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.enqueueMoneyMutationFromRpcError.mockReturnValue({
      kind: "permanent",
      queuedMutationId: "settlement.create:failed"
    });

    await expect(createSettlementWithOfflineQueue(input)).rejects.toBe(error);

    expect(mocks.enqueueMoneyMutationFromRpcError).toHaveBeenCalledWith({
      error,
      ownerUserId: "tanvir",
      payload: expect.objectContaining({
        p_client_mutation_id: "settlement:test-id"
      }),
      type: "settlement.create"
    });
  });
});
