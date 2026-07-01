import { useRouter, type Href } from "expo-router";
import { CircleAlert, Cloud, CloudOff, RefreshCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { Text, lightColors, spacing } from "@baki/ui";

import { useSyncStatus } from "@/features/offline/use-sync-status";

export function SyncStatusIndicator() {
  const { t } = useTranslation();
  const router = useRouter();
  const sync = useSyncStatus();
  const isFailed = sync.state === "failed";
  const isPending = sync.state === "pending";
  const isSyncing = sync.state === "syncing";
  const label = isFailed
    ? t("sync.status.failed")
    : isSyncing
      ? t("sync.status.syncing")
      : isPending
        ? t("sync.status.pending", { count: sync.pendingCount })
        : t("sync.status.synced");

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityHint={t("sync.action.openDetails")}
      accessibilityRole="button"
      onPress={() => router.push("/settings/sync" as Href)}
      style={({ pressed }) => ({
        alignItems: "center",
        flexDirection: "row",
        gap: spacing.xs,
        minHeight: 44,
        opacity: pressed ? 0.64 : 1,
        paddingHorizontal: spacing.md
      })}
    >
      {isFailed ? (
        <CircleAlert color={lightColors.negative} size={18} />
      ) : isSyncing ? (
        <RefreshCw color={lightColors.brandPrimary} size={18} />
      ) : isPending ? (
        <CloudOff color={lightColors.warning} size={18} />
      ) : (
        <Cloud color={lightColors.brandPrimary} size={18} />
      )}
      <Text tone="secondary" variant="caption">
        {label}
      </Text>
    </Pressable>
  );
}
