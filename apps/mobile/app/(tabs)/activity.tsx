import { formatMoney, formatRelativeDhakaDate, toBengaliNumerals } from "@baki/i18n";
import { useQueries } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { Activity as ActivityIcon, Layers3, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, TextInput, View } from "react-native";

import { Skeleton, Text, radii, spacing, useTheme } from "@baki/ui";

import { ActivityFeedList, type ActivityFeedSection } from "@/components/activity-feed-list";
import { BakiEmptyState } from "@/components/baki-empty-state";
import { useSession } from "@/features/auth/use-session";
import { expensesKeys, fetchExpenses } from "@/features/expenses/use-expenses";
import { useGroups } from "@/features/groups/use-groups";
import { tabScreenBottomInset } from "@/lib/layout";
import { usePreferencesStore } from "@/stores/preferences";

function formatDisplayCount(count: number, locale: string): string {
  return locale === "bn" ? toBengaliNumerals(count) : String(count);
}

export default function ActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const locale = usePreferencesStore((state) => state.locale);
  const session = useSession();
  const groupsQuery = useGroups();
  const groups = groupsQuery.data ?? [];
  const [query, setQuery] = useState("");
  const firstGroupId = groups[0]?.id;
  const addTarget = firstGroupId
    ? (`/group/${firstGroupId}/add-expense` as Href)
    : ("/groups/create" as Href);
  const addLabel = firstGroupId ? t("expense.add.title") : t("groups.create.cta");
  const expenseQueries = useQueries({
    queries: groups.map((group) => ({
      enabled: Boolean(session.userId),
      queryFn: () => fetchExpenses(group.id),
      queryKey: expensesKeys.list(group.id),
      staleTime: 1000 * 30
    }))
  });

  const activityItems = useMemo(
    () =>
      groups
        .flatMap((group, groupIndex) =>
          (expenseQueries[groupIndex]?.data ?? []).map((expense) => ({
            ...expense,
            groupId: group.id,
            groupName: group.name
          }))
        )
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 20),
    [expenseQueries, groups]
  );
  const searchTerm = query.trim().toLowerCase();
  const filteredActivityItems = useMemo(() => {
    if (!searchTerm) return activityItems;

    return activityItems.filter((item) => {
      const searchableText = [
        item.description,
        item.groupName,
        t(`expense.category.${item.category}`),
        formatMoney(item.amountPaisa, locale)
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchTerm);
    });
  }, [activityItems, locale, searchTerm, t]);
  const activitySections = useMemo<ActivityFeedSection[]>(() => {
    const sections = new Map<string, ActivityFeedSection>();

    for (const item of filteredActivityItems) {
      const title = formatRelativeDhakaDate(item.occurredAt, locale);
      const existing = sections.get(title);
      const selfPaid = item.paidBy === session.userId;
      const feedItem = {
        amountAccessibilityLabel: formatMoney(item.amountPaisa, locale),
        amountLabel: formatMoney(item.amountPaisa, locale),
        category: item.category,
        categoryLabel: t(`expense.category.${item.category}`),
        description: item.description,
        eventLabel: t("activity.event.expense_added"),
        groupName: item.groupName,
        id: `${item.groupId}-${item.id}`,
        onPress: () => router.push(`/group/${item.groupId}` as Href),
        paidBySelf: selfPaid,
        payerLabel: selfPaid ? t("expense.list.you_paid") : t("activity.list.someone_paid")
      };

      if (existing) {
        existing.items.push(feedItem);
        existing.countLabel = t("activity.section.count", {
          count: formatDisplayCount(existing.items.length, locale)
        });
      } else {
        sections.set(title, {
          countLabel: t("activity.section.count", {
            count: formatDisplayCount(1, locale)
          }),
          id: title,
          items: [feedItem],
          title
        });
      }
    }

    return Array.from(sections.values());
  }, [filteredActivityItems, locale, router, session.userId, t]);
  const uniqueActivityGroupCount = useMemo(
    () => new Set(filteredActivityItems.map((item) => item.groupId)).size,
    [filteredActivityItems]
  );
  const activitySummaryMetrics = useMemo(() => {
    const selfPaidPaisa = filteredActivityItems.reduce(
      (total, item) => total + (item.paidBy === session.userId ? item.amountPaisa : 0),
      0
    );
    const othersPaidPaisa = filteredActivityItems.reduce(
      (total, item) => total + (item.paidBy === session.userId ? 0 : item.amountPaisa),
      0
    );
    const latestLabel = filteredActivityItems[0]
      ? formatRelativeDhakaDate(filteredActivityItems[0].occurredAt, locale)
      : "-";

    return [
      {
        label: t("activity.summary.youPaid"),
        tone: "positive" as const,
        value: formatMoney(selfPaidPaisa, locale)
      },
      {
        label: t("activity.summary.othersPaid"),
        tone: "neutral" as const,
        value: formatMoney(othersPaidPaisa, locale)
      },
      {
        label: t("activity.summary.latest"),
        tone: "neutral" as const,
        value: latestLabel
      }
    ];
  }, [filteredActivityItems, locale, session.userId, t]);
  const showLoadingRows =
    groupsQuery.isPending ||
    (groups.length > 0 && expenseQueries.some((query) => query.isPending && !query.data));

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.lg,
          padding: spacing.lg,
          paddingBottom: tabScreenBottomInset
        }}
        style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
            <Text style={{ color: colors.inkPrimary, flex: 1 }} variant="h2">
              {t("groups.detail.activity.title")}
            </Text>
          </View>

          {!showLoadingRows && activityItems.length > 0 ? (
            <View
              style={{
                alignItems: "center",
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderRadius: radii.pill,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing.sm,
                minHeight: 44,
                paddingHorizontal: spacing.lg
              }}
            >
              <Search color={colors.inkMuted} size={18} />
              <TextInput
                accessibilityLabel={t("common.search")}
                accessibilityRole="search"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder={t("activity.search.placeholder")}
                placeholderTextColor={colors.inkMuted}
                returnKeyType="search"
                style={{
                  color: colors.inkPrimary,
                  flex: 1,
                  fontFamily: "HindSiliguri_400Regular",
                  fontSize: 15,
                  paddingVertical: 0
                }}
                testID="activity-search-input"
                value={query}
              />
            </View>
          ) : null}
        </View>

        {showLoadingRows ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={68} style={{ backgroundColor: colors.bgSubtle }} />
            <Skeleton height={68} style={{ backgroundColor: colors.bgSubtle }} />
            <Skeleton height={68} style={{ backgroundColor: colors.bgSubtle }} />
          </View>
        ) : activityItems.length > 0 ? (
          <View style={{ gap: spacing.lg }}>
            {filteredActivityItems.length > 0 ? (
              <>
                <View
                  style={{
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    gap: spacing.md,
                    padding: spacing.lg
                  }}
                  testID="activity-summary-card"
                >
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
                    <View
                      style={{
                        alignItems: "center",
                        backgroundColor: colors.tintBrand,
                        borderRadius: radii.pill,
                        height: 44,
                        justifyContent: "center",
                        width: 44
                      }}
                    >
                      <Layers3 color={colors.brandPrimary} size={20} />
                    </View>
                    <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
                      <Text variant="bodyStrong">{t("activity.summary.title")}</Text>
                      <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="caption">
                        {t("activity.summary.body", {
                          expenses: formatDisplayCount(filteredActivityItems.length, locale),
                          groups: formatDisplayCount(uniqueActivityGroupCount, locale)
                        })}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    {activitySummaryMetrics.map((metric) => (
                      <View
                        key={metric.label}
                        style={{
                          backgroundColor:
                            metric.tone === "positive" ? colors.tintPositive : colors.bgSubtle,
                          borderRadius: radii.md,
                          flex: 1,
                          gap: spacing.xs,
                          minWidth: 0,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.sm
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
                              metric.tone === "positive" ? colors.positive : colors.inkPrimary,
                            fontVariant: ["tabular-nums"]
                          }}
                          variant="bodyStrong"
                        >
                          {metric.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <ActivityFeedList sections={activitySections} />
              </>
            ) : (
              <BakiEmptyState
                action={{
                  accessibilityLabel: t("common.clear_search"),
                  label: t("common.clear_search"),
                  onPress: () => setQuery(""),
                  variant: "secondary"
                }}
                body={t("activity.search.empty.body")}
                icon={Search}
                testID="activity-search-empty-state"
                title={t("activity.search.empty.title")}
                tone="neutral"
              />
            )}
          </View>
        ) : (
          <BakiEmptyState
            action={{
              accessibilityLabel: addLabel,
              label: addLabel,
              onPress: () => router.push(addTarget)
            }}
            body={t("activity.empty.body")}
            icon={ActivityIcon}
            testID="activity-empty-state"
            title={t("activity.empty.title")}
            tone={groups.length > 0 ? "brand" : "neutral"}
          />
        )}
      </ScrollView>
    </View>
  );
}
