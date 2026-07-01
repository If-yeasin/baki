import type { E2ETestAuthConfig, E2ETestAuthDisabledReason } from "./test-auth-guard";

export type E2ETestAuthErrorCode =
  | E2ETestAuthDisabledReason
  | "seed_sign_in_failed"
  | "seed_user_mismatch"
  | "supabase_unconfigured";

export class E2ETestAuthError extends Error {
  code: E2ETestAuthErrorCode;

  constructor(code: E2ETestAuthErrorCode) {
    super(code);
    this.code = code;
  }
}

type SeedSignInResponse = {
  data: {
    user: { id: string } | null;
  };
  error: Error | null;
};

export type SignInWithE2ESeedUserInput = {
  config: E2ETestAuthConfig;
  isSupabaseConfigured: boolean;
  persistUserId: (userId: string | null) => void;
  signInWithPassword: (credentials: {
    email: string;
    password: string;
  }) => Promise<SeedSignInResponse>;
  signOut: () => Promise<unknown>;
};

export async function signInWithE2ESeedUser({
  config,
  isSupabaseConfigured,
  persistUserId,
  signInWithPassword,
  signOut
}: SignInWithE2ESeedUserInput): Promise<{ userId: string }> {
  if (!config.enabled) {
    throw new E2ETestAuthError(config.reason);
  }

  if (!isSupabaseConfigured) {
    throw new E2ETestAuthError("supabase_unconfigured");
  }

  const { data, error } = await signInWithPassword({
    email: config.seedEmail,
    password: config.seedPassword
  });

  if (error || !data.user?.id) {
    throw new E2ETestAuthError("seed_sign_in_failed");
  }

  if (data.user.id !== config.expectedUserId) {
    persistUserId(null);
    await signOut();
    throw new E2ETestAuthError("seed_user_mismatch");
  }

  persistUserId(data.user.id);
  return { userId: data.user.id };
}
