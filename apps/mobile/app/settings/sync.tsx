import { Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { AlertCircle, CheckCircle2, Clock3, Copy, RefreshCw, Trash2 } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { Text, Toast, radii, spacing, useTheme } from "@baki/ui";

import { BakiEmptyState } from "@/components/baki-empty-state";
import { SettingsRow, SettingsSection } from "@/components/settings-section";
import {
  listQueuedMutations,
  markQueuedMutationRetried,
  removeQueuedMutation,
  type QueuedMutation
} from "@/features/offline/mutation-queue";
import {
  buildFailedQueuedMutationDebugText,
  buildSyncDetailMetrics,
  canDismissFailedQueuedMutation,
  formatFailedQueuedMutationSubtitle,
  formatSyncCount,
  redactSensitiveSyncText,
  selectFailedQueuedMutations
} from "@/features/offline/sync-details-view-model";
import { runQueuedMutationSync } from "@/features/offline/sync-orchestrator";
import { useSyncSnapshot } from "@/features/offline/use-queued-mutation-processor";
import { usePreferencesStore } from "@/stores/preferences";

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
  const [queueVersion, setQueueVersion] = useState(0);
  const queuedMutations = useMemo(() => listQueuedMutations(), [queueVersion, snapshot]);
  const failedMutations = selectFailedQueuedMutations(queuedMutations);
  const hasQueue = queuedMutations.length > 0;

  const metrics = useMemo(
    () =>
      buildSyncDetailMetrics({
        failedLabel: t("sync.details.failed"),
        lastSyncLabel: t("sync.details.lastSync"),
        locale,
        neverLabel: t("sync.details.never"),
        pendingLabel: t("sync.details.pending"),
        snapshot
      }),
    [locale, snapshot, t]
  );

  async function handleRetryNow() {
    try {
      const result = await runQueuedMutationSync({ reason: "manual", retryFailed: true });
      setNotice({
        body: t("sync.details.retryComplete.body", {
          failed: formatSyncCount(result.failed, locale),
          retried: formatSyncCount(result.retried, locale),
          succeeded: formatSyncCount(result.succeeded, locale)
        }),
        title: t("sync.details.retryComplete.title"),
        variant: result.failed > 0 ? "info" : "success"
      });
    } catch (error) {
      setNotice({
        body: error instanceof Error ? redactSensitiveSyncText(error.message) : undefined,
        title: t("sync.details.retryFailed.title"),
        variant: "error"
      });
    }
  }

  async function handleRetryFailedMutation(mutation: QueuedMutation) {
    markQueuedMutationRetried(mutation.id);
    setQueueVersion((version) => version + 1);
    await handleRetryNow();
  }

  async function handleCopyDebug(mutation: QueuedMutation) {
    await Clipboard.setStringAsync(buildFailedQueuedMutationDebugText(mutation));
    setNotice({
      title: t("sync.details.debugCopied.title"),
      variant: "success"
    });
  }

  function handleDismissFailedMutation(mutation: QueuedMutation) {
    if (!canDismissFailedQueuedMutation(mutation)) {
      setNotice({
        body: t("sync.details.dismissBlocked.body"),
        title: t("sync.details.dismissBlocked.title"),
        variant: "info"
      });
      return;
    }

    Alert.alert(t("sync.details.dismiss.confirm.title"), t("sync.details.dismiss.confirm.body"), [
      {
        style: "cancel",
        text: t("common.cancel")
      },
      {
        onPress: () => {
          removeQueuedMutation(mutation.id);
          setQueueVersion((version) => version + 1);
          setNotice({
            title: t("sync.details.dismissed.title"),
            variant: "success"
          });
        },
        style: "destructive",
        text: t("sync.details.dismiss.cta")
      }
    ]);
  }

  function renderFailedMutationActions(mutation: QueuedMutation) {
    return (
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        <IconAction
          accessibilityLabel={t("sync.details.copyDebug.cta")}
          icon={<Copy color={colors.inkMuted} size={16} />}
          onPress={() => {
            void handleCopyDebug(mutation);
          }}
        />
        <IconAction
          accessibilityLabel={t("sync.details.retryOne.cta")}
          icon={<RefreshCw color={colors.brandPrimary} size={16} />}
          onPress={() => {
            void handleRetryFailedMutation(mutation);
          }}
        />
        <IconAction
          accessibilityLabel={t("sync.details.dismiss.cta")}
          disabled={!canDismissFailedQueuedMutation(mutation)}
          icon={
            <Trash2
              color={
                canDismissFailedQueuedMutation(mutation) ? colors.negative : colors.borderStrong
              }
              size={16}
            />
          }
          onPress={() => handleDismissFailedMutation(mutation)}
        />
      </View>
    );
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
            count: formatSyncCount(snapshot.pendingCount, locale)
          })}
          title={t("sync.details.pending")}
        />
        <SettingsRow
          icon={<AlertCircle color={colors.negative} size={19} />}
          showDivider={false}
          subtitle={t("sync.details.failedSubtitle", {
            count: formatSyncCount(snapshot.failedCount, locale)
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
              subtitle={formatFailedQueuedMutationSubtitle(
                mutation,
                t("sync.details.failedUnknown")
              )}
              title={t(`sync.mutation.${mutation.type}`, {
                defaultValue: mutation.type
              })}
              trailing={renderFailedMutationActions(mutation)}
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
            {redactSensitiveSyncText(snapshot.lastErrorMessage)}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function IconAction({
  accessibilityLabel,
  disabled,
  icon,
  onPress
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? colors.bgSubtle : "transparent",
        borderRadius: radii.pill,
        height: 34,
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
        width: 34
      })}
    >
      {icon}
    </Pressable>
  );
}
