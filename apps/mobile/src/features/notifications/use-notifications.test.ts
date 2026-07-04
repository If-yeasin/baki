import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    },
    from: mocks.from
  }
}));

vi.mock("expo-constants", () => ({
  default: {
    easConfig: { projectId: "project-1" },
    expoConfig: { extra: { eas: { projectId: "project-1" } } }
  }
}));

vi.mock("expo-notifications", () => ({
  getExpoPushTokenAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn()
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" }
}));

import {
  fetchNotificationPreferences,
  fetchRegisteredDeviceTokenCount
} from "./use-notifications";

const preferenceRow = {
  created_at: "2026-07-04T00:00:00.000Z",
  expense_activity: true,
  push_enabled: false,
  reminders: true,
  settlement_activity: true,
  updated_at: "2026-07-04T00:00:00.000Z",
  user_id: "user-1"
};

describe("notification preference helpers", () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it("creates fresh preference rows without enabling push delivery", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const selectExisting = vi.fn().mockReturnValue({ eq });
    const single = vi.fn().mockResolvedValue({ data: preferenceRow, error: null });
    const selectInserted = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInserted });

    mocks.from
      .mockReturnValueOnce({ select: selectExisting })
      .mockReturnValueOnce({ insert });

    await expect(fetchNotificationPreferences("user-1")).resolves.toEqual(preferenceRow);
    expect(insert).toHaveBeenCalledWith({
      expense_activity: true,
      push_enabled: false,
      reminders: true,
      settlement_activity: true,
      user_id: "user-1"
    });
  });

  it("reads registered device status from device token rows", async () => {
    const eq = vi.fn().mockResolvedValue({ count: 2, error: null });
    const select = vi.fn().mockReturnValue({ eq });

    mocks.from.mockReturnValueOnce({ select });

    await expect(fetchRegisteredDeviceTokenCount("user-1")).resolves.toBe(2);
    expect(mocks.from).toHaveBeenCalledWith("device_tokens");
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
