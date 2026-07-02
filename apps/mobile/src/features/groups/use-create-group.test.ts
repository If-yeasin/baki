import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  enqueueMutation: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getQueuedMutationErrorDetails: vi.fn(),
  isPermanentQueuedMutationError: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  single: vi.fn()
}));

vi.mock("@/features/offline/mutation-queue", () => ({
  enqueueMutation: mocks.enqueueMutation,
  getQueuedMutationErrorDetails: mocks.getQueuedMutationErrorDetails,
  isPermanentQueuedMutationError: mocks.isPermanentQueuedMutationError
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: mocks.captureException
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc
  }
}));

vi.mock("./use-groups", () => ({
  groupsKeys: {
    detail: (id: string) => ["groups", "detail", id],
    list: () => ["groups", "list"]
  }
}));

import { buildCreateGroupRpcPayload, createGroupWithOfflineQueue } from "./use-create-group";

const groupRow = {
  archived_at: null,
  avatar_url: null,
  client_mutation_id: "group:test",
  created_at: "2026-07-02T00:00:00.000Z",
  created_by: "user-1",
  deleted_at: null,
  id: "group-id",
  invite_code: "abc123",
  name: "Sajek trip",
  template: "trip",
  updated_at: "2026-07-02T00:00:00.000Z"
};

describe("buildCreateGroupRpcPayload", () => {
  it("trims the name and sends a client mutation id", () => {
    expect(buildCreateGroupRpcPayload({ name: "  Sajek trip  ", template: "trip" })).toEqual({
      p_client_mutation_id: expect.stringMatching(/^group:/),
      p_name: "Sajek trip",
      p_template: "trip"
    });
  });
});

describe("createGroupWithOfflineQueue", () => {
  beforeEach(() => {
    mocks.captureException.mockReset();
    mocks.enqueueMutation.mockReset();
    mocks.eq.mockReset();
    mocks.from.mockReset();
    mocks.getQueuedMutationErrorDetails.mockReset();
    mocks.isPermanentQueuedMutationError.mockReset();
    mocks.rpc.mockReset();
    mocks.select.mockReset();
    mocks.single.mockReset();

    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({ data: groupRow, error: null });
    mocks.getQueuedMutationErrorDetails.mockReturnValue({
      code: undefined,
      message: "Network request failed"
    });
    mocks.enqueueMutation.mockReturnValue({ id: "group.create:queued" });
  });

  it("returns the created group after the create_group RPC succeeds", async () => {
    mocks.rpc.mockResolvedValue({ data: "group-id", error: null });

    await expect(
      createGroupWithOfflineQueue({ name: "  Sajek trip  ", template: "trip" })
    ).resolves.toEqual({
      group: {
        archivedAt: null,
        createdAt: "2026-07-02T00:00:00.000Z",
        createdBy: "user-1",
        id: "group-id",
        inviteCode: "abc123",
        name: "Sajek trip",
        template: "trip",
        updatedAt: "2026-07-02T00:00:00.000Z"
      },
      status: "synced"
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_group", {
      p_client_mutation_id: expect.stringMatching(/^group:/),
      p_name: "Sajek trip",
      p_template: "trip"
    });
    expect(mocks.from).toHaveBeenCalledWith("groups");
    expect(mocks.eq).toHaveBeenCalledWith("id", "group-id");
  });

  it("returns queued success for temporary RPC failures", async () => {
    const error = new Error("Network request failed");
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.isPermanentQueuedMutationError.mockReturnValue(false);

    await expect(
      createGroupWithOfflineQueue({ name: "Sajek trip", template: "trip" })
    ).resolves.toEqual({
      queuedMutationId: "group.create:queued",
      status: "queued"
    });

    expect(mocks.enqueueMutation).toHaveBeenCalledWith({
      payload: {
        p_client_mutation_id: expect.stringMatching(/^group:/),
        p_name: "Sajek trip",
        p_template: "trip"
      },
      type: "group.create"
    });
    expect(mocks.captureException).toHaveBeenCalledWith(error, {
      tags: { feature: "groups.create" }
    });
  });

  it("throws permanent failures after keeping them visible as failed queue items", async () => {
    const error = { code: "23514", message: "invalid_group_name" };
    mocks.rpc.mockResolvedValue({ data: null, error });
    mocks.getQueuedMutationErrorDetails.mockReturnValue({
      code: "23514",
      message: "invalid_group_name"
    });
    mocks.isPermanentQueuedMutationError.mockReturnValue(true);

    await expect(createGroupWithOfflineQueue({ name: "", template: "trip" })).rejects.toBe(error);

    expect(mocks.enqueueMutation).toHaveBeenCalledWith({
      failedAt: expect.any(String),
      lastErrorCode: "23514",
      lastErrorMessage: "invalid_group_name",
      payload: {
        p_client_mutation_id: expect.stringMatching(/^group:/),
        p_name: "",
        p_template: "trip"
      },
      status: "failed",
      type: "group.create"
    });
  });
});
