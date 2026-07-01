const E2E_ENABLED_VALUES = new Set(["true", "1", "yes"]);
const PRODUCTION_MARKERS = new Set(["production", "prod"]);
const ALLOWED_BUILD_PROFILES = new Set([
  "development",
  "development:device",
  "preview",
  "preview-e2e"
]);
const ALLOWED_CHANNELS = new Set(["dev", "development", "preview", "preview-e2e"]);
const ALLOWED_SUPABASE_ENVS = new Set(["local", "preview", "test"]);

export type E2ETestAuthDisabledReason =
  | "e2e_flag_disabled"
  | "fixture_missing"
  | "not_preview_or_dev"
  | "production_supabase"
  | "production_variant";

export type E2ETestAuthGuardInput = {
  appChannel?: boolean | number | string | null;
  buildProfile?: boolean | number | string | null;
  e2eMode?: boolean | number | string | null;
  isDev: boolean;
  seedEmail?: boolean | number | string | null;
  seedPassword?: boolean | number | string | null;
  seedUserId?: boolean | number | string | null;
  supabaseEnv?: boolean | number | string | null;
};

export type E2ETestAuthConfig =
  | {
      enabled: true;
      expectedUserId: string;
      seedEmail: string;
      seedPassword: string;
    }
  | {
      enabled: false;
      reason: E2ETestAuthDisabledReason;
    };

function normalize(value: boolean | number | string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizeLower(value: boolean | number | string | null | undefined): string {
  return normalize(value).toLowerCase();
}

function isE2EModeEnabled(value: boolean | number | string | null | undefined): boolean {
  if (value === true) return true;
  return E2E_ENABLED_VALUES.has(normalizeLower(value));
}

export function canUseE2ETestAuth(input: E2ETestAuthGuardInput): E2ETestAuthConfig {
  const appChannel = normalizeLower(input.appChannel);
  const buildProfile = normalizeLower(input.buildProfile);
  const seedEmail = normalize(input.seedEmail);
  const seedPassword = normalize(input.seedPassword);
  const expectedUserId = normalize(input.seedUserId);
  const supabaseEnv = normalizeLower(input.supabaseEnv);

  if (!isE2EModeEnabled(input.e2eMode)) {
    return { enabled: false, reason: "e2e_flag_disabled" };
  }

  if (PRODUCTION_MARKERS.has(appChannel) || PRODUCTION_MARKERS.has(buildProfile)) {
    return { enabled: false, reason: "production_variant" };
  }

  const isAllowedVariant =
    input.isDev || ALLOWED_BUILD_PROFILES.has(buildProfile) || ALLOWED_CHANNELS.has(appChannel);

  if (!isAllowedVariant) {
    return { enabled: false, reason: "not_preview_or_dev" };
  }

  if (!ALLOWED_SUPABASE_ENVS.has(supabaseEnv)) {
    return { enabled: false, reason: "production_supabase" };
  }

  if (!expectedUserId || !seedEmail || !seedPassword) {
    return { enabled: false, reason: "fixture_missing" };
  }

  return {
    enabled: true,
    expectedUserId,
    seedEmail,
    seedPassword
  };
}
