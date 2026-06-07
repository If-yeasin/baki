import { type SupportedLocale } from "@baki/i18n";
import i18next from "i18next";

import { Tabs } from "./Tabs";

export type LanguageToggleProps = {
  accessibilityLabel?: string;
  onChange: (locale: SupportedLocale) => void;
  value: SupportedLocale;
};

export function LanguageToggle({ accessibilityLabel, onChange, value }: LanguageToggleProps) {
  return (
    <Tabs
      accessibilityLabel={accessibilityLabel ?? i18next.t("settings.language.title")}
      items={[
        { label: i18next.t("settings.language.bn"), value: "bn" },
        { label: i18next.t("settings.language.en"), value: "en" }
      ]}
      onValueChange={(next) => onChange(next as SupportedLocale)}
      value={value}
    />
  );
}
