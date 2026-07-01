import { formatRelativeDhakaDate, toBengaliNumerals, type AppLocale } from "@baki/i18n";
import { Stack } from "expo-router";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { Text, Toast, radii, spacing, useTheme } from "@baki/ui";

import { BakiEmptyState } from "@/components/baki-empty-state";
import { SettingsRow, SettingsSection } from "@/components/settings-section";
import { listQueuedMutations } from "@/features/offline/mutation-queue";
import {
  runQueuedMutationSync,
  type QueuedMutationSyncSnapshot
} from "@/features/offline/sync-orchestrator";
import { useSyncSnapshot } from "@/features/offline/use-queued-mutation-processor";
import { usePreferencesStore } from "@/stores/preferences";

function formatCount(value: number, locale: string) {
  return locale === "bn" ? toBengaliNumerals(value) : String(value);
}

function formatLastSync(snapshot: QueuedMutationSyncSnapshot, locale: AppLocale, fallback: string) {
  return snapshot.lastSyncAt ? formatRelativeDhakaDate(snapshot.lastSyncAt, locale) : fallback;
}

export default function SyncDetailsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const locale = usePreferencesStore((state) => state.locale);
  const snapshot = useSyncSnapshot();
  const [notice, setNotice] = useState<{
    body?: string;
    title: string;
    variant: "error" | "info" | "success";
  } | null>(null);
  const queuedMutations = listQueuedMutations();
  const failedMutations = queuedMutations.filter((mutation) => mutation.status === "failed");
  const hasQueue = queuedMutations.length > 0;

  const metrics = useMemo(
    () => [
      {
        label: t("sync.details.pending"),
        tone: "warning" as const,
        value: formatCount(snapshot.pendingCount, locale)
      },
      {
        label: t("sync.details.failed"),
        tone: "negative" as const,
        value: formatCount(snapshot.failedCount, locale)
      },
      {
        label: t("sync.details.lastSync"),
        tone: "neutral" as const,
        value: formatLastSync(snapshot, locale, t("sync.details.never"))
      }
    ],
    [locale, snapshot, t]
  );

  async function handleRetryNow() {
    try {
      const result = await runQueuedMutationSync({ reason: "manual", retryFailed: true });
      setNotice({
        body: t("sync.details.retryComplete.body", {
          failed: formatCount(result.failed, locale),
          retried: formatCount(result.retried, locale),
          succeeded: formatCount(result.succeeded, locale)
        }),
        title: t("sync.details.retryComplete.title"),
        variant: result.failed > 0 ? "info" : "success"
      });
    } catch (error) {
      setNotice({
        body: error instanceof Error ? error.message : undefined,
        title: t("sync.details.retryFailed.title"),
        variant: "error"
      });
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        gap: spacing.lg,
        padding: spacing.lg,
        paddingBottom: spacing["4xl"]
      }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Stack.Screen options={{ title: t("sync.details.title") }} />

      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.inkPrimary }} variant="h2">
          {t("sync.details.title")}
        </Text>
        <Text style={{ color: colors.inkSecondary }} variant="body">
          {t("sync.details.body")}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {metrics.map((metric) => (
          <View
            key={metric.label}
            style={{
              backgroundColor:
                metric.tone === "negative"
                  ? colors.tintNegative
                  : metric.tone === "warning"
                    ? colors.tintWarning
                    : colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              borderWidth: 1,
              flex: 1,
              gap: spacing.xs,
              minHeight: 82,
              minWidth: 0,
              padding: spacing.md
            }}
          >
            <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="label">
              {metric.label}
            </Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={{
                color:
                  metric.tone === "negative"
                    ? colors.negative
                    : metric.tone === "warning"
                      ? colors.warning
                      : colors.inkPrimary,
                fontVariant: ["tabular-nums"]
              }}
              variant="bodyStrong"
            >
              {metric.value}
            </Text>
          </View>
        ))}
      </View>

      {notice ? (
        <Toast
          dismissLabel={t("common.dismiss")}
          message={notice.body}
          onDismiss={() => setNotice(null)}
          testID="sync-details-notice"
          title={notice.title}
          variant={notice.variant}
        />
      ) : null}

      <Pressable
        accessibilityLabel={t("sync.action.retry")}
        accessibilityRole="button"
        disabled={snapshot.isSyncing}
        onPress={handleRetryNow}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.brandPrimary,
          borderRadius: radii.pill,
          flexDirection: "row",
          gap: spacing.sm,
          justifyContent: "center",
          minHeight: 48,
          opacity: snapshot.isSyncing ? 0.52 : pressed ? 0.82 : 1,
          paddingHorizontal: spacing.lg
        })}
        testID="sync-retry-now"
      >
        <RefreshCw color={colors.inkOnBrand} size={18} />
        <Text style={{ color: colors.inkOnBrand }} variant="bodyStrong">
          {snapshot.isSyncing ? t("sync.status.syncing") : t("sync.action.retry")}
        </Text>
      </Pressable>

      <SettingsSection title={t("sync.details.queueTitle")}>
        <SettingsRow
          icon={<Clock3 color={colors.warning} size={19} />}
          subtitle={t("sync.details.pendingSubtitle", {
            count: formatCount(snapshot.pendingCount, locale)
          })}
          title={t("sync.details.pending")}
        />
        <SettingsRow
          icon={<AlertCircle color={colors.negative} size={19} />}
          showDivider={false}
          subtitle={t("sync.details.failedSubtitle", {
            count: formatCount(snapshot.failedCount, locale)
          })}
          title={t("sync.details.failed")}
        />
      </SettingsSection>

      {failedMutations.length > 0 ? (
        <SettingsSection title={t("sync.details.failedItems")}>
          {failedMutations.map((mutation, index) => (
            <SettingsRow
              key={mutation.id}
              icon={<AlertCircle color={colors.negative} size={19} />}
              showDivider={index !== failedMutations.length - 1}
              subtitle={
                mutation.lastErrorCode
                  ? `${mutation.lastErrorCode} · ${mutation.lastErrorMessage ?? ""}`
                  : (mutation.lastErrorMessage ?? t("sync.details.failedUnknown"))
              }
              title={t(`sync.mutation.${mutation.type}`, {
                defaultValue: mutation.type
              })}
            />
          ))}
        </SettingsSection>
      ) : hasQueue ? null : (
        <BakiEmptyState
          body={t("sync.details.empty.body")}
          icon={CheckCircle2}
          testID="sync-details-empty-state"
          title={t("sync.details.empty.title")}
          tone="positive"
        />
      )}

      {snapshot.lastErrorMessage ? (
        <View
          style={{
            backgroundColor: colors.tintWarning,
            borderRadius: radii.md,
            gap: spacing.xs,
            padding: spacing.md
          }}
        >
          <Text style={{ color: colors.warning }} variant="label">
            {snapshot.lastErrorCode ?? t("sync.details.lastError")}
          </Text>
          <Text style={{ color: colors.inkSecondary }} variant="caption">
            {snapshot.lastErrorMessage}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
