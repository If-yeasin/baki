import { Stack } from "expo-router";
import { FileText } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Text, radii, spacing, useTheme } from "@baki/ui";

const termKeys = [
  "settings.terms.point.ledger",
  "settings.terms.point.payments",
  "settings.terms.point.sync",
  "settings.terms.point.deletion"
] as const;

export default function TermsSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["4xl"] }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Stack.Screen options={{ title: t("settings.terms.title") }} />
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.inkPrimary }} variant="h2">
          {t("settings.terms.title")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("settings.terms.body")}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          gap: spacing.md,
          padding: spacing.lg
        }}
      >
        <FileText color={colors.brandPrimary} size={24} />
        {termKeys.map((key) => (
          <Text key={key} tone="secondary" variant="body">
            {t(key)}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
