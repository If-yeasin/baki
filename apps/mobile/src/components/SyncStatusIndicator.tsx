import { CircleAlert, Cloud, CloudOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Text, lightColors, spacing } from "@baki/ui";

import { useSyncStatus } from "@/features/offline/use-sync-status";

export function SyncStatusIndicator() {
  const { t } = useTranslation();
  const sync = useSyncStatus();
  const isFailed = sync.state === "failed";
  const isPending = sync.state === "pending";
  const label = isFailed
    ? t("sync.status.failed")
    : isPending
      ? t("sync.status.pending", { count: sync.pendingCount })
      : t("sync.status.synced");

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="summary"
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing.xs,
        minHeight: 44,
        paddingHorizontal: spacing.md
      }}
    >
      {isFailed ? (
        <CircleAlert color={lightColors.negative} size={18} />
      ) : isPending ? (
        <CloudOff color={lightColors.warning} size={18} />
      ) : (
        <Cloud color={lightColors.brandPrimary} size={18} />
      )}
      <Text tone="secondary" variant="caption">
        {label}
      </Text>
    </View>
  );
}
