import { useEffect, useState } from "react";

import { Sentry } from "@/lib/sentry";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

import {
  createSessionLookupGuard,
  getPersistedUserId,
  persistUserId
} from "./session-storage";

export { getPersistedUserId, persistUserId } from "./session-storage";

// When the Expo Go preview ships without `.env.local`, Supabase URL/key are
// empty strings. In that case we must not call `supabase.auth.*` because the
// auth gate should fall through to /(auth)/phone without waiting on network.
export type SessionState = {
  isLoading: boolean;
  userId: string | null;
};

/**
 * Cheap signed-in detector. Starts from the persisted MMKV value (so the
 * gate doesn't flicker) and then trusts Supabase as the source of truth.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() => ({
    isLoading: isSupabaseConfigured,
    userId: isSupabaseConfigured ? getPersistedUserId() : null
  }));

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No backend configured (e.g. Expo Go preview without env). Drop any
      // stale persisted id and let the gate fall through to /(auth)/phone.
      persistUserId(null);
      setState({ isLoading: false, userId: null });
      return;
    }

    let mounted = true;
    const lookupGuard = createSessionLookupGuard();
    const lookupEpoch = lookupGuard.capture();

    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted || !lookupGuard.isCurrent(lookupEpoch)) return;

        const nextId = data.user?.id ?? null;
        persistUserId(nextId);
        setState({ isLoading: false, userId: nextId });
      } catch (error) {
        if (!mounted || !lookupGuard.isCurrent(lookupEpoch)) return;
        Sentry.captureException(error, { tags: { feature: "auth.session" } });
        persistUserId(null);
        setState({ isLoading: false, userId: null });
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      lookupGuard.invalidate();
      const nextId = session?.user?.id ?? null;
      persistUserId(nextId);
      setState({ isLoading: false, userId: nextId });
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
