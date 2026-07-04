import { Stack } from "expo-router";
import { Bell, BellRing } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Switch, View } from "react-native";

import { SettingsRow, SettingsSection, SettingsStatusPill } from "@/components/settings-section";
import { useSession } from "@/features/auth/use-session";
import {
  useNotificationPreferences,
  useRegisterDeviceForPushNotifications,
  useRegisteredDeviceTokenCount,
  useUpdateNotificationPreferences,
  type NotificationPreferencePatch,
  type NotificationPreferences
} from "@/features/notifications/use-notifications";
import { Skeleton, Text, Toast, spacing, useTheme } from "@baki/ui";

type Notice = {
  body?: string;
  title: string;
  variant: "error" | "success";
};

type PreferenceKey = keyof Pick<
  NotificationPreferences,
  "expense_activity" | "push_enabled" | "reminders" | "settlement_activity"
>;

const preferenceKeys: PreferenceKey[] = [
  "push_enabled",
  "expense_activity",
  "settlement_activity",
  "reminders"
];

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const session = useSession();
  const preferencesQuery = useNotificationPreferences(session.userId);
  const registeredDeviceTokenCountQuery = useRegisteredDeviceTokenCount(session.userId);
  const updatePreferences = useUpdateNotificationPreferences(session.userId);
  const registerDevice = useRegisterDeviceForPushNotifications();
  const [notice, setNotice] = useState<Notice | null>(null);
  const preferences = preferencesQuery.data;
  const hasRegisteredDevice = (registeredDeviceTokenCountQuery.data ?? 0) > 0;

  function handleRegister() {
    registerDevice.mutate(undefined, {
      onError: () => {
        setNotice({
          body: t("settings.notifications.error.body"),
          title: t("settings.notifications.error.title"),
          variant: "error"
        });
      },
      onSuccess: () => {
        void preferencesQuery.refetch();
        void registeredDeviceTokenCountQuery.refetch();
        setNotice({
          body: t("settings.notifications.register.success.body"),
          title: t("settings.notifications.register.success.title"),
          variant: "success"
        });
      }
    });
  }

  function handleToggle(key: PreferenceKey, value: boolean) {
    const patch: NotificationPreferencePatch = { [key]: value };
    updatePreferences.mutate(patch, {
      onError: () => {
        setNotice({
          title: t("settings.notifications.error.title"),
          variant: "error"
        });
      }
    });
  }

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["4xl"] }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Stack.Screen options={{ title: t("settings.notifications.title") }} />
      <Text style={{ color: colors.inkPrimary }} variant="h2">
        {t("settings.notifications.title")}
      </Text>
      <Text tone="secondary" variant="body">
        {t("settings.notifications.body")}
      </Text>

      {notice ? (
        <Toast
          dismissLabel={t("common.dismiss")}
          message={notice.body}
          onDismiss={() => setNotice(null)}
          title={notice.title}
          variant={notice.variant}
        />
      ) : null}

      <SettingsSection title={t("settings.notifications.register.title")}>
        <SettingsRow
          accessibilityLabel={t("settings.notifications.register.cta")}
          disabled={registerDevice.isPending}
          icon={<BellRing color={colors.brandPrimary} size={19} />}
          onPress={handleRegister}
          showDivider={false}
          subtitle={t("settings.notifications.register.subtitle")}
          testID="settings-register-notifications"
          title={
            registerDevice.isPending
              ? t("settings.notifications.register.pending")
              : t("settings.notifications.register.cta")
          }
          trailing={
            hasRegisteredDevice ? (
              <SettingsStatusPill tone="brand">
                {t("settings.notifications.status.registered")}
              </SettingsStatusPill>
            ) : undefined
          }
        />
      </SettingsSection>

      <SettingsSection title={t("settings.notifications.preferences.title")}>
        {preferencesQuery.isPending ? (
          <View style={{ gap: spacing.sm, padding: spacing.md }}>
            <Skeleton height={56} />
            <Skeleton height={56} />
          </View>
        ) : (
          preferenceKeys.map((key, index) => (
            <SettingsRow
              accessibilityLabel={t(`settings.notifications.preference.${key}.title`)}
              icon={<Bell color={colors.brandPrimary} size={19} />}
              key={key}
              onPress={() => handleToggle(key, !(preferences?.[key] ?? true))}
              showDivider={index < preferenceKeys.length - 1}
              subtitle={t(`settings.notifications.preference.${key}.subtitle`)}
              title={t(`settings.notifications.preference.${key}.title`)}
              trailing={
                <Switch
                  accessibilityLabel={t(`settings.notifications.preference.${key}.title`)}
                  ios_backgroundColor={colors.borderStrong}
                  onValueChange={(value) => handleToggle(key, value)}
                  thumbColor={colors.bgSurface}
                  trackColor={{
                    false: colors.borderStrong,
                    true: colors.brandPrimary
                  }}
                  value={preferences?.[key] ?? true}
                />
              }
            />
          ))
        )}
      </SettingsSection>
    </ScrollView>
  );
}
