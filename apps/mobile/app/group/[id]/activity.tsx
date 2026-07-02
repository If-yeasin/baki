import {
  formatMoney,
  formatRelativeDhakaDate,
  toBengaliNumerals,
  type AppLocale
} from "@baki/i18n";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Activity as ActivityIcon } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Skeleton, spacing, useTheme } from "@baki/ui";

import { ActivityFeedList, type ActivityFeedSection } from "@/components/activity-feed-list";
import { BakiEmptyState } from "@/components/baki-empty-state";
import { useGroupActivity, type ActivityLogItem } from "@/features/activity/use-activity-log";
import { useSession } from "@/features/auth/use-session";
import { useGroupDetail } from "@/features/groups/use-group-detail";
import { usePreferencesStore } from "@/stores/preferences";

function formatDisplayCount(count: number, locale: string): string {
  return locale === "bn" ? toBengaliNumerals(count) : String(count);
}

export default function GroupActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? "";
  const locale = usePreferencesStore((state) => state.locale);
  const session = useSession();
  const { colors } = useTheme();
  const detailQuery = useGroupDetail(groupId);
  const activityQuery = useGroupActivity(groupId);
  const groupName = detailQuery.data?.group.name ?? t("groups.detail.fallback_title");

  const sections = useMemo<ActivityFeedSection[]>(() => {
    const grouped = new Map<string, ActivityFeedSection>();

    for (const item of activityQuery.data ?? []) {
      const title = formatRelativeDhakaDate(item.createdAt, locale);
      const existing = grouped.get(title);
      const feedItem = toFeedItem({
        currentUserId: session.userId,
        groupName,
        item,
        locale,
        onPress: () => router.push(`/group/${groupId}` as Href),
        t
      });

      if (existing) {
        existing.items.push(feedItem);
        existing.countLabel = t("activity.section.count", {
          count: formatDisplayCount(existing.items.length, locale)
        });
      } else {
        grouped.set(title, {
          countLabel: t("activity.section.count", {
            count: formatDisplayCount(1, locale)
          }),
          id: title,
          items: [feedItem],
          title
        });
      }
    }

    return Array.from(grouped.values());
  }, [activityQuery.data, groupId, groupName, locale, router, session.userId, t]);

  const isLoading = detailQuery.isPending || activityQuery.isPending;

  return (
    <ScrollView
      contentContainerStyle={{
        gap: spacing.lg,
        padding: spacing.lg,
        paddingBottom: spacing["4xl"]
      }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Stack.Screen options={{ title: t("groups.detail.activity.title") }} />

      {isLoading ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={68} />
          <Skeleton height={68} />
          <Skeleton height={68} />
        </View>
      ) : sections.length > 0 ? (
        <ActivityFeedList sections={sections} />
      ) : (
        <BakiEmptyState
          body={t("activity.empty.body")}
          icon={ActivityIcon}
          testID="group-activity-empty-state"
          title={t("activity.empty.title")}
          tone="neutral"
        />
      )}
    </ScrollView>
  );
}

function toFeedItem({
  currentUserId,
  groupName,
  item,
  locale,
  onPress,
  t
}: {
  currentUserId: string | null;
  groupName: string;
  item: ActivityLogItem;
  locale: AppLocale;
  onPress: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}): ActivityFeedSection["items"][number] {
  const actorLabel = item.actorId === currentUserId ? t("activity.actor.you") : item.actorName;
  const eventLabel = t(`activity.event.${item.eventType}`);
  const amountLabel =
    typeof item.amountPaisa === "number" ? formatMoney(item.amountPaisa, locale) : undefined;
  const methodLabel = item.method
    ? t(`settle.via.${item.method}`, { defaultValue: item.method })
    : undefined;

  return {
    amountAccessibilityLabel: amountLabel,
    amountLabel,
    category: item.eventType.startsWith("expense_") ? "other" : undefined,
    categoryLabel: methodLabel,
    description: item.description ?? eventLabel,
    eventLabel,
    groupName,
    id: item.id,
    leadingTone:
      item.eventType === "settled"
        ? "settlement"
        : item.eventType.startsWith("member_")
          ? "member"
        : item.eventType.startsWith("group_") || item.eventType === "invite_regenerated"
          ? "group"
          : "expense",
    onPress,
    paidBySelf: item.actorId === currentUserId,
    payerLabel: actorLabel
  };
}
