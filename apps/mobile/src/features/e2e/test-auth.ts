import Constants from "expo-constants";

import { persistUserId } from "@/features/auth/use-session";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

import { canUseE2ETestAuth, type E2ETestAuthConfig } from "./test-auth-guard";
import { signInWithE2ESeedUser } from "./test-auth-session";

type E2EExtra = {
  appChannel?: unknown;
  easBuildProfile?: unknown;
  e2eMode?: unknown;
  e2eSeedEmail?: unknown;
  e2eSeedPassword?: unknown;
  e2eSeedUserId?: unknown;
};

function getExpoExtra(): E2EExtra {
  return (Constants.expoConfig?.extra ?? {}) as E2EExtra;
}

export function getE2ETestAuthConfig(): E2ETestAuthConfig {
  const extra = getExpoExtra();

  return canUseE2ETestAuth({
    appChannel: extra.appChannel as string | undefined,
    buildProfile: extra.easBuildProfile as string | undefined,
    e2eMode: extra.e2eMode as string | undefined,
    isDev: __DEV__,
    seedEmail: extra.e2eSeedEmail as string | undefined,
    seedPassword: extra.e2eSeedPassword as string | undefined,
    seedUserId: extra.e2eSeedUserId as string | undefined
  });
}

export function signInWithSeedUserForE2E(): Promise<{ userId: string }> {
  return signInWithE2ESeedUser({
    config: getE2ETestAuthConfig(),
    isSupabaseConfigured,
    persistUserId,
    signInWithPassword: (credentials) => supabase.auth.signInWithPassword(credentials),
    signOut: () => supabase.auth.signOut()
  });
}
