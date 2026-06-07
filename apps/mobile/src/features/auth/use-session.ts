import { useEffect, useState } from "react";

import { storage } from "@/lib/mmkv";
import { Sentry } from "@/lib/sentry";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const USER_ID_KEY = "auth.userId.v1";

// When the Expo Go preview ships without `.env.local`, Supabase URL/key are
// empty strings. In that case we must not call `supabase.auth.*` because the
// auth gate should fall through to /(auth)/phone without waiting on network.
export function persistUserId(userId: string | null) {
  if (userId) {
    storage.set(USER_ID_KEY, userId);
  } else {
    storage.delete(USER_ID_KEY);
  }
}

export function getPersistedUserId(): string | null {
  return storage.getString(USER_ID_KEY) ?? null;
}

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

    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;

        const nextId = data.user?.id ?? null;
        persistUserId(nextId);
        setState({ isLoading: false, userId: nextId });
      } catch (error) {
        if (!mounted) return;
        Sentry.captureException(error, { tags: { feature: "auth.session" } });
        persistUserId(null);
        setState({ isLoading: false, userId: null });
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
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
