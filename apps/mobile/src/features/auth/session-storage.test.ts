import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mmkv", () => ({
  storage: {
    delete: vi.fn(),
    getString: vi.fn(),
    set: vi.fn()
  }
}));

import { createSessionLookupGuard } from "./session-storage";

describe("createSessionLookupGuard", () => {
  it("invalidates a pending lookup after a newer auth event", () => {
    const guard = createSessionLookupGuard();
    const pendingLookup = guard.capture();

    expect(guard.isCurrent(pendingLookup)).toBe(true);

    guard.invalidate();

    expect(guard.isCurrent(pendingLookup)).toBe(false);
    expect(guard.isCurrent(guard.capture())).toBe(true);
  });
});
