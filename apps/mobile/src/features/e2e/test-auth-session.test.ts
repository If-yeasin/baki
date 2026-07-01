import { describe, expect, it, vi } from "vitest";

import { signInWithE2ESeedUser, E2ETestAuthError } from "./test-auth-session";

const enabledConfig = {
  enabled: true,
  expectedUserId: "11111111-1111-4111-8111-111111111111",
  seedEmail: "tanvir@example.test",
  seedPassword: "password"
} as const;

describe("signInWithE2ESeedUser", () => {
  it("does not call Supabase Auth when the guard is disabled", async () => {
    const signInWithPassword = vi.fn();

    await expect(
      signInWithE2ESeedUser({
        config: { enabled: false, reason: "e2e_flag_disabled" },
        isSupabaseConfigured: true,
        persistUserId: vi.fn(),
        signInWithPassword,
        signOut: vi.fn()
      })
    ).rejects.toMatchObject({ code: "e2e_flag_disabled" });

    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("persists the seeded user id after password auth succeeds", async () => {
    const persistUserId = vi.fn();
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: enabledConfig.expectedUserId } },
      error: null
    });

    await expect(
      signInWithE2ESeedUser({
        config: enabledConfig,
        isSupabaseConfigured: true,
        persistUserId,
        signInWithPassword,
        signOut: vi.fn()
      })
    ).resolves.toEqual({ userId: enabledConfig.expectedUserId });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: enabledConfig.seedEmail,
      password: enabledConfig.seedPassword
    });
    expect(persistUserId).toHaveBeenCalledWith(enabledConfig.expectedUserId);
  });

  it("signs out and clears the persisted id when the seed auth user is unexpected", async () => {
    const persistUserId = vi.fn();
    const signOut = vi.fn().mockResolvedValue(undefined);

    await expect(
      signInWithE2ESeedUser({
        config: enabledConfig,
        isSupabaseConfigured: true,
        persistUserId,
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: "22222222-2222-4222-8222-222222222222" } },
          error: null
        }),
        signOut
      })
    ).rejects.toBeInstanceOf(E2ETestAuthError);

    expect(persistUserId).toHaveBeenCalledWith(null);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("fails closed when Supabase is not configured", async () => {
    await expect(
      signInWithE2ESeedUser({
        config: enabledConfig,
        isSupabaseConfigured: false,
        persistUserId: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn()
      })
    ).rejects.toMatchObject({ code: "supabase_unconfigured" });
  });
});
