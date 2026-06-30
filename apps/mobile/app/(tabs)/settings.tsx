import { toBengaliNumerals, type AppLocale } from "@baki/i18n";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import {
  Bell,
  ChevronRight,
  Download,
  FileText,
  HelpCircle,
  Languages,
  LogOut,
  Moon,
  Phone,
  ShieldCheck,
  Trash2
} from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, View } from "react-native";

import {
  Avatar,
  LanguageToggle,
  Skeleton,
  Tabs,
  Text,
  Toast,
  radii,
  spacing,
  useTheme
} from "@baki/ui";

import { SettingsRow, SettingsSection, SettingsStatusPill } from "@/components/settings-section";
import { DeleteAccountError, useDeleteAccount } from "@/features/auth/use-delete-account";
import { persistUserId, useSession } from "@/features/auth/use-session";
import { i18n } from "@/lib/i18n";
import { tabScreenBottomInset } from "@/lib/layout";
import { storage } from "@/lib/mmkv";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import { usePreferencesStore, type ThemePreference } from "@/stores/preferences";

const PROFILE_CACHE_KEY = "profile.cache.v1";

function maskPhone(phone: string | null | undefined, locale: AppLocale): string {
  if (!phone) return "";
  const masked = phone.replace(/^(\+8801\d{1})\d+(\d{2})$/, "$1*****$2");
  return locale === "bn" ? toBengaliNumerals(masked) : masked;
}

type ProfileRow = {
  display_name: string;
  phone: string;
};

type SettingsNotice = {
  bodyKey: string;
  titleKey: string;
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useSession();
  const locale = usePreferencesStore((state) => state.locale);
  const setLocale = usePreferencesStore((state) => state.setLocale);
  const themePreference = usePreferencesStore((state) => state.theme);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const deleteAccount = useDeleteAccount();
  const { colors } = useTheme();
  const [settingsNotice, setSettingsNotice] = useState<SettingsNotice | null>(null);

  const profileQuery = useQuery({
    enabled: Boolean(session.userId),
    queryFn: async (): Promise<ProfileRow | null> => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, phone")
          .eq("id", session.userId as string)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          storage.set(PROFILE_CACHE_KEY, JSON.stringify(data));
        }

        return data;
      } catch (error) {
        const raw = storage.getString(PROFILE_CACHE_KEY);
        if (raw) {
          try {
            const cached = JSON.parse(raw) as ProfileRow;
            Sentry.captureException(error, {
              tags: { feature: "settings.profile", fallback: "mmkv" }
            });
            return cached;
          } catch {
            // Keep the original failure so React Query can surface retry state.
          }
        }
        throw error;
      }
    },
    queryKey: ["profile", session.userId]
  });

  async function handleLanguageChange(next: AppLocale) {
    setLocale(next);
    await i18n.changeLanguage(next);

    if (session.userId) {
      void supabase.from("profiles").update({ locale: next }).eq("id", session.userId);
    }
  }

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Sentry.captureException(error, { tags: { feature: "settings.signOut" } });
      Alert.alert(t("settings.error.sign_out_failed"));
      return;
    }
    persistUserId(null);
    router.replace("/" as Href);
  }

  function handleDeleteAccount() {
    Alert.alert(
      t("settings.account.delete.confirm.title"),
      t("settings.account.delete.confirm.body"),
      [
        { style: "cancel", text: t("common.cancel") },
        {
          onPress: () => {
            deleteAccount.mutate(undefined, {
              onError: (error) => {
                const code = error instanceof DeleteAccountError ? error.code : "generic";
                const isOffline =
                  code === "FunctionsFetchError" || /network|fetch/i.test(error.message ?? "");

                let messageKey = "settings.account.delete.error.generic";
                if (isOffline) {
                  messageKey = "common.error.offline";
                } else if (code === "unsettled_balances") {
                  messageKey = "settings.account.delete.error.unsettled_balances";
                } else if (code === "not_authenticated") {
                  messageKey = "auth.error.session_failed";
                }

                Alert.alert(t("settings.account.delete"), t(messageKey));
              },
              onSuccess: () => {
                router.replace("/" as Href);
              }
            });
          },
          style: "destructive",
          text: t("settings.account.delete.confirm.cta")
        }
      ]
    );
  }

  function showSettingsNotice(titleKey: string, bodyKey: string) {
    setSettingsNotice({ bodyKey, titleKey });
  }

  const profileName = profileQuery.data?.display_name || t("common.unknown_user");
  const phoneLabel = maskPhone(profileQuery.data?.phone, locale);
  const themeItems = [
    { label: t("settings.theme.system"), value: "system" },
    { label: t("settings.theme.light"), value: "light" },
    { label: t("settings.theme.dark"), value: "dark" }
  ] as const;
  const renderSoonTrailing = () => (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.xs }}>
      <SettingsStatusPill>{t("settings.status.soon")}</SettingsStatusPill>
      <ChevronRight color={colors.inkMuted} size={18} />
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={{
        gap: spacing.lg,
        padding: spacing.lg,
        paddingBottom: tabScreenBottomInset
      }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Text style={{ color: colors.inkPrimary }} variant="h2">
        {t("settings.title")}
      </Text>

      <View
        style={{
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          gap: spacing.md,
          padding: spacing.md
        }}
        testID="settings-profile-card"
      >
        {profileQuery.isPending ? (
          <ProfileLoadingState />
        ) : (
          <>
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
              <Avatar name={profileName} size="lg" />
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ color: colors.inkPrimary }}
                  variant="h3"
                >
                  {profileName}
                </Text>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={2}
                  style={{ color: colors.inkSecondary }}
                  variant="caption"
                >
                  {t("settings.profile.subtitle")}
                </Text>
              </View>
              <SettingsStatusPill tone="brand">{t("settings.profile.verified")}</SettingsStatusPill>
            </View>
            {phoneLabel ? (
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: colors.bgSubtle,
                  borderRadius: radii.sm,
                  flexDirection: "row",
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm
                }}
              >
                <Phone color={colors.brandPrimary} size={17} />
                <Text numberOfLines={1} style={{ flex: 1 }} tone="secondary" variant="caption">
                  {phoneLabel}
                </Text>
                <ShieldCheck color={colors.positive} size={17} />
              </View>
            ) : null}
          </>
        )}
      </View>

      <SettingsSection title={t("settings.section.preferences")}>
        <SettingsRow
          icon={<Languages color={colors.brandPrimary} size={19} />}
          subtitle={t("settings.language.subtitle")}
          title={t("settings.language.title")}
        />
        <View style={{ padding: spacing.md, paddingTop: 0 }}>
          <LanguageToggle onChange={handleLanguageChange} value={locale} />
        </View>
        <SettingsRow
          icon={<Moon color={colors.brandPrimary} size={19} />}
          subtitle={t("settings.theme.subtitle")}
          title={t("settings.theme.title")}
        />
        <View style={{ padding: spacing.md, paddingTop: 0 }}>
          <Tabs
            accessibilityLabel={t("settings.theme.title")}
            items={themeItems}
            onValueChange={handleThemeChange}
            size="sm"
            value={themePreference}
          />
        </View>
      </SettingsSection>

      <SettingsSection title={t("settings.section.data")}>
        <SettingsRow
          icon={<Bell color={colors.brandPrimary} size={19} />}
          onPress={() =>
            showSettingsNotice(
              "settings.notifications.notice.title",
              "settings.notifications.notice.body"
            )
          }
          subtitle={t("settings.notifications.subtitle")}
          testID="settings-notifications-row"
          title={t("settings.notifications.title")}
          trailing={renderSoonTrailing()}
        />
        <SettingsRow
          icon={<Download color={colors.brandPrimary} size={19} />}
          onPress={() =>
            showSettingsNotice("settings.export.notice.title", "settings.export.notice.body")
          }
          subtitle={t("settings.export.subtitle")}
          testID="settings-export-row"
          title={t("settings.export.title")}
          trailing={renderSoonTrailing()}
        />
        <SettingsRow
          icon={<FileText color={colors.brandPrimary} size={19} />}
          onPress={() =>
            showSettingsNotice("settings.privacy.notice.title", "settings.privacy.notice.body")
          }
          subtitle={t("settings.privacy.subtitle")}
          testID="settings-privacy-row"
          title={t("settings.privacy.title")}
          trailing={<ChevronRight color={colors.inkMuted} size={18} />}
        />
        <SettingsRow
          icon={<HelpCircle color={colors.brandPrimary} size={19} />}
          onPress={() =>
            showSettingsNotice("settings.support.notice.title", "settings.support.notice.body")
          }
          showDivider={false}
          subtitle={t("settings.support.subtitle")}
          testID="settings-support-row"
          title={t("settings.support.title")}
          trailing={renderSoonTrailing()}
        />
      </SettingsSection>

      {settingsNotice ? (
        <Toast
          dismissLabel={t("common.dismiss")}
          message={t(settingsNotice.bodyKey)}
          onDismiss={() => setSettingsNotice(null)}
          testID="settings-notice"
          title={t(settingsNotice.titleKey)}
          variant="info"
        />
      ) : null}

      <SettingsSection title={t("settings.section.account")}>
        <SettingsRow
          icon={<LogOut color={colors.brandPrimary} size={19} />}
          onPress={handleSignOut}
          subtitle={t("settings.account.signOut.subtitle")}
          title={t("settings.account.signOut")}
        />
        <SettingsRow
          destructive
          disabled={deleteAccount.isPending}
          icon={<Trash2 color={colors.negative} size={19} />}
          onPress={handleDeleteAccount}
          showDivider={false}
          subtitle={t("settings.account.delete.subtitle")}
          title={
            deleteAccount.isPending
              ? t("settings.account.delete.pending")
              : t("settings.account.delete")
          }
        />
      </SettingsSection>

      <View
        style={{
          backgroundColor: colors.tintWarning,
          borderRadius: radii.md,
          gap: spacing.xs,
          padding: spacing.md
        }}
      >
        <Text style={{ color: colors.warning }} variant="label">
          {t("settings.account.safety.title")}
        </Text>
        <Text style={{ color: colors.inkSecondary }} variant="caption">
          {t("settings.account.safety.body")}
        </Text>
      </View>
    </ScrollView>
  );
}

function ProfileLoadingState() {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
        <Skeleton height={56} style={{ borderRadius: radii.pill, width: 56 }} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton height={18} style={{ backgroundColor: colors.bgSubtle, width: "58%" }} />
          <Skeleton height={14} style={{ backgroundColor: colors.bgSubtle, width: "76%" }} />
        </View>
      </View>
      <Skeleton height={38} style={{ backgroundColor: colors.bgSubtle }} />
    </View>
  );
}
