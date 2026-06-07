// Expo Go cannot load native modules — fall back to in-memory storage so the app can preview. Data does NOT persist across reloads in Expo Go.
import { isExpoGo } from "./expo-runtime";

export interface BakiStorage {
  delete(key: string): void;
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

function createMemoryStorage(): BakiStorage {
  const map = new Map<string, string>();
  return {
    delete: (key) => {
      map.delete(key);
    },
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    }
  };
}

function createNativeStorage(): BakiStorage {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require("react-native-mmkv") as typeof import("react-native-mmkv");
  const instance = new MMKV({ id: "baki" });
  return {
    delete: (key) => instance.delete(key),
    getString: (key) => instance.getString(key),
    set: (key, value) => instance.set(key, value)
  };
}

export const storage: BakiStorage = isExpoGo ? createMemoryStorage() : createNativeStorage();
