import i18n, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import bn from "./bn.json";
import en from "./en.json";

export { formatIndianNumber, formatMoney, toBengaliNumerals, toLatinNumerals } from "./format";
export type { SupportedLocale } from "./format";

export const resources = {
  bn: { translation: bn },
  en: { translation: en }
} as const;

export type TranslationKey = keyof typeof bn;
export type AppLocale = keyof typeof resources;

export function initBakiI18n(locale: AppLocale = "bn"): I18nInstance {
  if (i18n.isInitialized) {
    void i18n.changeLanguage(locale);
    return i18n;
  }

  void i18n.use(initReactI18next).init({
    compatibilityJSON: "v4",
    fallbackLng: "bn",
    interpolation: {
      escapeValue: false
    },
    lng: locale,
    resources
  });

  return i18n;
}

export { bn, en, i18n };
