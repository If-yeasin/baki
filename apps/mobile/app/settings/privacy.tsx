import { Stack, useRouter, type Href } from "expo-router";
import { ChevronRight, FileText, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { SettingsRow, SettingsSection } from "@/components/settings-section";
import { Text, radii, spacing, useTheme } from "@baki/ui";

export default function PrivacySettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["4xl"] }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Stack.Screen options={{ title: t("settings.privacy.title") }} />
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.inkPrimary }} variant="h2">
          {t("settings.privacy.title")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("settings.privacy.body")}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          gap: spacing.sm,
          padding: spacing.lg
        }}
      >
        <ShieldCheck color={colors.brandPrimary} size={24} />
        <Text variant="bodyStrong">{t("settings.privacy.boundary.title")}</Text>
        <Text tone="secondary" variant="body">
          {t("settings.privacy.boundary.body")}
        </Text>
      </View>

      <SettingsSection title={t("settings.privacy.documents.title")}>
        <SettingsRow
          icon={<FileText color={colors.brandPrimary} size={19} />}
          onPress={() => router.push("/settings/terms" as Href)}
          showDivider={false}
          subtitle={t("settings.terms.subtitle")}
          title={t("settings.terms.title")}
          trailing={<ChevronRight color={colors.inkMuted} size={18} />}
        />
      </SettingsSection>
    </ScrollView>
  );
}
