import { describe, expect, it } from "vitest";

import { canUseE2ETestAuth } from "./test-auth-guard";

const fixture = {
  seedEmail: "tanvir@example.test",
  seedPassword: "password",
  seedUserId: "11111111-1111-4111-8111-111111111111",
  supabaseEnv: "preview"
};

describe("canUseE2ETestAuth", () => {
  it("is disabled when the E2E flag is missing", () => {
    expect(
      canUseE2ETestAuth({
        ...fixture,
        appChannel: "preview",
        e2eMode: "false",
        isDev: true
      })
    ).toEqual({ enabled: false, reason: "e2e_flag_disabled" });
  });

  it("is disabled in production even when the E2E flag and fixtures are present", () => {
    expect(
      canUseE2ETestAuth({
        ...fixture,
        appChannel: "production",
        buildProfile: "production",
        e2eMode: "true",
        isDev: false
      })
    ).toEqual({ enabled: false, reason: "production_variant" });
  });

  it("is disabled for release builds without a preview or dev marker", () => {
    expect(
      canUseE2ETestAuth({
        ...fixture,
        buildProfile: "adhoc",
        e2eMode: "true",
        isDev: false
      })
    ).toEqual({ enabled: false, reason: "not_preview_or_dev" });
  });

  it("requires the non-secret seeded user fixture", () => {
    expect(
      canUseE2ETestAuth({
        appChannel: fixture.supabaseEnv,
        e2eMode: "true",
        isDev: false,
        seedEmail: "tanvir@example.test",
        seedPassword: "password",
        supabaseEnv: fixture.supabaseEnv
      })
    ).toEqual({ enabled: false, reason: "fixture_missing" });
  });

  it("is disabled when E2E does not declare a local, preview, or test Supabase target", () => {
    expect(
      canUseE2ETestAuth({
        ...fixture,
        appChannel: "preview",
        e2eMode: "true",
        isDev: false,
        supabaseEnv: "production"
      })
    ).toEqual({ enabled: false, reason: "production_supabase" });
  });

  it("is enabled for preview E2E builds with the complete fixture", () => {
    expect(
      canUseE2ETestAuth({
        ...fixture,
        buildProfile: "preview-e2e",
        e2eMode: "true",
        isDev: false
      })
    ).toEqual({
      enabled: true,
      expectedUserId: fixture.seedUserId,
      seedEmail: fixture.seedEmail,
      seedPassword: fixture.seedPassword
    });
  });

  it("is enabled in local dev only when the E2E flag is explicit", () => {
    expect(
      canUseE2ETestAuth({
        ...fixture,
        e2eMode: "true",
        isDev: true
      }).enabled
    ).toBe(true);
  });
});
