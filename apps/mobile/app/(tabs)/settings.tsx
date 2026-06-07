import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { ChevronRight, Languages, Moon, Phone, UserRound } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, View } from "react-native";

import type { AppLocale } from "@baki/i18n";
import { Button, LanguageToggle, Skeleton, Text, radii, spacing, useTheme } from "@baki/ui";

import { DeleteAccountError, useDeleteAccount } from "@/features/auth/use-delete-account";
import { persistUserId, useSession } from "@/features/auth/use-session";
import { i18n } from "@/lib/i18n";
import { storage } from "@/lib/mmkv";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import { usePreferencesStore } from "@/stores/preferences";

const PROFILE_CACHE_KEY = "profile.cache.v1";

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  // Preserves the +880 country code and operator digit (first 6 chars) plus the last 2 digits, masks the middle.
  // Bengali rendering happens at the component layer if needed; here we
  // just produce a non-PII string for display.
  return phone.replace(/^(\+8801\d{1})\d+(\d{2})$/, "$1*****$2");
}

type ProfileRow = {
  display_name: string;
  phone: string;
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useSession();
  const locale = usePreferencesStore((state) => state.locale);
  const setLocale = usePreferencesStore((state) => state.setLocale);
  const deleteAccount = useDeleteAccount();
  const { colors } = useTheme();

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
            // fall through and rethrow original error
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
      // Best-effort sync to profile; failures don't block the UI toggle.
      void supabase.from("profiles").update({ locale: next }).eq("id", session.userId);
    }
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

  return (
    <ScrollView
      contentContainerStyle={{
        gap: spacing.lg,
        padding: spacing.lg,
        paddingBottom: spacing["3xl"]
      }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Text style={{ color: colors.inkPrimary }} variant="h2">
        {t("settings.title")}
      </Text>

      <View
        style={{ backgroundColor: colors.bgSurface, borderRadius: radii.md, overflow: "hidden" }}
      >
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.inkSecondary }} variant="label">
            {t("settings.profile.title")}
          </Text>
        </View>
        {profileQuery.isPending ? (
          <View style={{ padding: spacing.md }}>
            <Skeleton height={56} style={{ backgroundColor: colors.bgSubtle }} />
          </View>
        ) : (
          <View>
            <PreferenceRow
              colors={colors}
              icon={<UserRound color={colors.brandPrimary} size={19} />}
              subtitle={profileQuery.data?.display_name ?? ""}
              title={t("settings.profile.name.label")}
            />
            <PreferenceRow
              colors={colors}
              icon={<Phone color={colors.brandPrimary} size={19} />}
              subtitle={maskPhone(profileQuery.data?.phone)}
              title={t("settings.profile.phone.label")}
            />
          </View>
        )}
      </View>

      <View
        style={{ backgroundColor: colors.bgSurface, borderRadius: radii.md, overflow: "hidden" }}
      >
        <PreferenceRow
          colors={colors}
          icon={<Languages color={colors.brandPrimary} size={19} />}
          subtitle={t("settings.language.subtitle")}
          title={t("settings.language.title")}
        />
        <View style={{ padding: spacing.md, paddingTop: 0 }}>
          <LanguageToggle onChange={handleLanguageChange} value={locale} />
        </View>
      </View>

      <View
        style={{ backgroundColor: colors.bgSurface, borderRadius: radii.md, overflow: "hidden" }}
      >
        <PreferenceRow
          colors={colors}
          icon={<Moon color={colors.brandPrimary} size={19} />}
          subtitle={t("settings.theme.system")}
          title={t("settings.theme.title")}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <Button
          onPress={handleSignOut}
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderStrong,
            borderWidth: 1
          }}
          variant="secondary"
        >
          {t("settings.account.signOut")}
        </Button>
        <Button
          disabled={deleteAccount.isPending}
          onPress={handleDeleteAccount}
          style={{ backgroundColor: colors.warning }}
          variant="destructive"
        >
          {t("settings.account.delete")}
        </Button>
      </View>
    </ScrollView>
  );
}

type PreferenceRowProps = {
  colors: ReturnType<typeof useTheme>["colors"];
  icon: React.ReactNode;
  subtitle?: string;
  title: string;
};

function PreferenceRow({ colors, icon, subtitle, title }: PreferenceRowProps) {
  return (
    <View
      accessibilityRole="summary"
      style={{
        alignItems: "center",
        borderBottomColor: colors.borderStrong,
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 58,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.bgSubtle,
          borderRadius: radii.sm,
          height: 34,
          justifyContent: "center",
          width: 34
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{ color: colors.inkPrimary }}
          variant="bodyStrong"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: colors.inkMuted }}
            variant="caption"
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={colors.inkMuted} size={18} />
    </View>
  );
}
