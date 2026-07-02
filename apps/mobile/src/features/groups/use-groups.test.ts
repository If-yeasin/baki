import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  from: vi.fn(),
  readLocalGroups: vi.fn(),
  upsertRemoteGroups: vi.fn()
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: mocks.captureException
  }
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from
  }
}));

vi.mock("@/watermelon/repositories/groups", () => ({
  readLocalGroups: mocks.readLocalGroups,
  upsertRemoteGroups: mocks.upsertRemoteGroups
}));

import { fetchGroups } from "./use-groups";
import type { GroupRow, GroupSummary } from "./types";

const remoteGroup = {
  archived_at: null,
  avatar_url: null,
  client_mutation_id: null,
  created_at: "2026-07-01T00:00:00.000Z",
  created_by: "user-1",
  deleted_at: null,
  id: "group-1",
  invite_code: "ABC123",
  name: "Mess Khata",
  template: "mess",
  updated_at: "2026-07-01T00:00:00.000Z"
} satisfies GroupRow;

const localGroup = {
  archivedAt: null,
  createdAt: "2026-06-30T00:00:00.000Z",
  createdBy: "user-2",
  id: "local-group",
  inviteCode: "LOCAL1",
  name: "Cached Khata",
  template: "custom",
  updatedAt: "2026-06-30T00:00:00.000Z"
} satisfies GroupSummary;

function mockGroupsQuery(result: { data: GroupRow[] | null; error: unknown }) {
  const query = {
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis()
  };
  mocks.from.mockReturnValueOnce(query);
  return query;
}

describe("fetchGroups", () => {
  beforeEach(() => {
    mocks.captureException.mockClear();
    mocks.from.mockReset();
    mocks.readLocalGroups.mockReset();
    mocks.upsertRemoteGroups.mockReset();
  });

  it("returns local groups when the remote query fails", async () => {
    const remoteError = new Error("offline");
    mocks.readLocalGroups.mockResolvedValueOnce([localGroup]);
    mockGroupsQuery({ data: null, error: remoteError });

    await expect(fetchGroups()).resolves.toEqual([localGroup]);
    expect(mocks.captureException).toHaveBeenCalledWith(remoteError, {
      tags: { feature: "groups.list" }
    });
    expect(mocks.upsertRemoteGroups).not.toHaveBeenCalled();
  });

  it("upserts remote groups into the local store", async () => {
    mocks.readLocalGroups.mockResolvedValueOnce([]);
    mockGroupsQuery({ data: [remoteGroup], error: null });

    await expect(fetchGroups()).resolves.toEqual([
      {
        archivedAt: null,
        createdAt: "2026-07-01T00:00:00.000Z",
        createdBy: "user-1",
        id: "group-1",
        inviteCode: "ABC123",
        name: "Mess Khata",
        template: "mess",
        updatedAt: "2026-07-01T00:00:00.000Z"
      }
    ]);
    expect(mocks.upsertRemoteGroups).toHaveBeenCalledWith([remoteGroup]);
  });
});
