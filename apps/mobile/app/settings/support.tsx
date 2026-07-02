import { Stack } from "expo-router";
import { Mail, MessageCircleQuestion } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, View } from "react-native";

import { SettingsRow, SettingsSection } from "@/components/settings-section";
import { Text, Toast, spacing, useTheme } from "@baki/ui";

type Notice = {
  title: string;
  variant: "error" | "success";
};

export default function SupportSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [notice, setNotice] = useState<Notice | null>(null);

  async function handleEmailSupport() {
    const url = "mailto:support@baki.app?subject=Baki%20support";
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      setNotice({ title: t("settings.support.error.title"), variant: "error" });
      return;
    }

    await Linking.openURL(url);
    setNotice({ title: t("settings.support.email.opened"), variant: "success" });
  }

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["4xl"] }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Stack.Screen options={{ title: t("settings.support.title") }} />
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.inkPrimary }} variant="h2">
          {t("settings.support.title")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("settings.support.body")}
        </Text>
      </View>

      {notice ? (
        <Toast
          dismissLabel={t("common.dismiss")}
          onDismiss={() => setNotice(null)}
          title={notice.title}
          variant={notice.variant}
        />
      ) : null}

      <SettingsSection title={t("settings.support.contact.title")}>
        <SettingsRow
          icon={<Mail color={colors.brandPrimary} size={19} />}
          onPress={handleEmailSupport}
          showDivider={false}
          subtitle="support@baki.app"
          title={t("settings.support.email.cta")}
        />
      </SettingsSection>

      <SettingsSection title={t("settings.support.scope.title")}>
        <SettingsRow
          icon={<MessageCircleQuestion color={colors.brandPrimary} size={19} />}
          showDivider={false}
          subtitle={t("settings.support.scope.subtitle")}
          title={t("settings.support.scope.body")}
        />
      </SettingsSection>
    </ScrollView>
  );
}
