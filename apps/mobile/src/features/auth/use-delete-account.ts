import { useMutation } from "@tanstack/react-query";

import { storage } from "@/lib/mmkv";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

import { persistUserId } from "./use-session";

const PROFILE_CACHE_KEY = "profile.cache.v1";

/**
 * Error thrown for failed account deletion. Carries the machine-readable
 * code from the Edge Function (e.g. `"unsettled_balances"`,
 * `"not_authenticated"`) so callers can map it to a localized message
 * without depending on raw HTTP details.
 */
export class DeleteAccountError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "DeleteAccountError";
    this.code = code;
  }
}

async function readMachineCode(error: unknown): Promise<string | null> {
  // FunctionsHttpError stores the raw Response in `context`. We try to parse
  // the JSON body to extract the `error` field, but never throw if it fails.
  const maybeContext = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (maybeContext && typeof maybeContext.json === "function") {
    try {
      const body = (await maybeContext.json()) as { error?: unknown } | null;
      if (body && typeof body.error === "string") {
        return body.error;
      }
    } catch {
      // Body was not JSON or already consumed; fall through.
    }
  }
  return null;
}

export function useDeleteAccount() {
  return useMutation<{ deleted: true }, DeleteAccountError>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ deleted: true }>("delete-account", {
        body: {}
      });

      if (error) {
        const code = (await readMachineCode(error)) ?? error.name ?? "generic";
        const wrapped = new DeleteAccountError(code, error.message);
        // Intentionally no PII (phone, bKash, Nagad) in tags. Feature tag only.
        Sentry.captureException(wrapped, { tags: { feature: "account.delete" } });
        throw wrapped;
      }

      if (!data?.deleted) {
        const wrapped = new DeleteAccountError("generic", "delete-account returned no payload");
        Sentry.captureException(wrapped, { tags: { feature: "account.delete" } });
        throw wrapped;
      }

      persistUserId(null);
      storage.delete(PROFILE_CACHE_KEY);

      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        Sentry.captureException(signOutError, {
          tags: { feature: "account.delete", phase: "local-sign-out" }
        });
      }

      return { deleted: true };
    }
  });
}
