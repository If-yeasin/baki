import { initBakiI18n, type AppLocale } from "@baki/i18n";

function detectLocale(): AppLocale {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale.toLowerCase().startsWith("en") ? "en" : "bn";
}

export const i18n = initBakiI18n(detectLocale());
