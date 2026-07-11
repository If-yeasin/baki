import { storage } from "@/lib/mmkv";

export const userIdStorageKey = "auth.userId.v1";

export function createSessionLookupGuard() {
  let authEventEpoch = 0;

  return {
    capture: () => authEventEpoch,
    invalidate: () => {
      authEventEpoch += 1;
    },
    isCurrent: (capturedEpoch: number) => capturedEpoch === authEventEpoch
  };
}

export function persistUserId(userId: string | null) {
  if (userId) {
    storage.set(userIdStorageKey, userId);
  } else {
    storage.delete(userIdStorageKey);
  }
}

export function getPersistedUserId(): string | null {
  return storage.getString(userIdStorageKey) ?? null;
}
