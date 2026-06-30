import { create } from "zustand";

import type { AppLocale } from "@baki/i18n";

export type ThemePreference = "light" | "dark" | "system";

type PreferencesState = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: ThemePreference) => void;
  theme: ThemePreference;
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  locale: "bn",
  setLocale: (locale) => set({ locale }),
  setTheme: (theme) => set({ theme }),
  theme: "system"
}));
