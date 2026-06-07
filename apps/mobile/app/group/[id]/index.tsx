import { formatMoney, formatRelativeDhakaDate } from "@baki/i18n";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { ArrowLeft, HandCoins, Plus, ReceiptText, Users } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, View } from "react-native";

import {
  Avatar,
  EmptyState,
  Skeleton,
  Text,
  radii,
  spacing,
  useTheme
} from "@baki/ui";

import { useSession } from "@/features/auth/use-session";
import { useGroupBalances } from "@/features/balances/use-balances";
import { useExpenses } from "@/features/expenses/use-expenses";
import { useGroupDetail } from "@/features/groups/use-group-detail";
import { usePreferencesStore } from "@/stores/preferences";

export default function GroupDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = usePreferencesStore((state) => state.locale);
  const session = useSession();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id;
  const { colors } = useTheme();

  const detailQuery = useGroupDetail(groupId);
  const expensesQuery = useExpenses(groupId);
  const balancesQuery = useGroupBalances(groupId);

  const selfNet = useMemo(() => {
    if (!session.userId) return 0;
    const row = balancesQuery.data?.find((entry) => entry.user_id === session.userId);
    return row?.net_paisa ?? 0;
  }, [balancesQuery.data, session.userId]);

  const expenses = expensesQuery.data ?? [];
  const groupName = detailQuery.data?.group.name ?? t("groups.detail.fallback_title");
  const memberCount = detailQuery.data?.members.length ?? 0;
  const memberLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of detailQuery.data?.members ?? []) {
      map.set(member.userId, member.displayName);
    }
    return map;
  }, [detailQuery.data]);

  const settled = selfNet === 0;
  const youAreOwed = selfNet > 0;
  const summaryColor = settled
    ? colors.inkPrimary
    : youAreOwed
      ? colors.positive
      : colors.negative;

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <Stack.Screen
        options={{
          headerShown: false,
          title: detailQuery.data?.group.name ?? t("common.loading")
        }}
      />
      <FlatList
        ItemSeparatorComponent={() => (
          <View
            style={{
              backgroundColor: colors.borderSubtle,
              height: 1,
              marginLeft: spacing.xl + 44 + spacing.md,
              marginRight: spacing.xl
            }}
          />
        )}
        ListEmptyComponent={
          expensesQuery.isPending ? (
            <View style={{ gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </View>
          ) : (
            <View style={{ padding: spacing.xl, paddingTop: spacing.md }}>
              <View
                style={{
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  padding: spacing.lg
                }}
              >
                <EmptyState
                  action={{
                    label: t("expense.add.title"),
                    onPress: () =>
                      router.push(`/group/${groupId}/add-expense` as Href)
                  }}
                  body={t("groups.detail.empty.expenses")}
                  title={t("expense.add.title")}
                />
              </View>
            </View>
          )
        }
        ListHeaderComponent={
          <View>
            {/* Cover band: app-bar + hero + balance card sit on a single
                bgSurface block with a single hairline divider at the foot.
                Keeps the header reading as one calm chunk before the dense
                expense list begins. */}
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderBottomColor: colors.borderSubtle,
                borderBottomWidth: 1,
                paddingBottom: spacing.lg
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing["3xl"]
                }}
              >
                <Pressable
                  accessibilityLabel={t("common.cancel")}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.back()}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    borderRadius: radii.pill,
                    height: 40,
                    justifyContent: "center",
                    opacity: pressed ? 0.6 : 1,
                    width: 40
                  })}
                >
                  <ArrowLeft color={colors.inkPrimary} size={22} />
                </Pressable>
                <View style={{ flex: 1 }} />
              </View>

              <View
                style={{
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.md
                }}
              >
                <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
                  <Avatar name={groupName} size="lg" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      ellipsizeMode="tail"
                      numberOfLines={2}
                      style={{ color: colors.inkPrimary }}
                      variant="h2"
                    >
                      {groupName}
                    </Text>
                    <View
                      style={{ alignItems: "center", flexDirection: "row", gap: spacing.xs }}
                    >
                      <Users color={colors.inkMuted} size={12} />
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        style={{ color: colors.inkMuted, flexShrink: 1 }}
                        variant="caption"
                      >
                        {memberCount > 0
                          ? t("groups.detail.members_count", { count: memberCount })
                          : detailQuery.data
                            ? t(`groups.template.${detailQuery.data.group.template}`)
                            : ""}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Overall balance card — on bgSubtle so it lifts off the
                    cover surface without a hard border. */}
                <View
                  style={{
                    backgroundColor: colors.bgSubtle,
                    borderRadius: radii.lg,
                    gap: spacing.xs,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md
                  }}
                >
                  <Text style={{ color: colors.inkMuted }} variant="label">
                    {t("groups.detail.overall")}
                  </Text>
                  <Text
                    accessibilityLabel={formatMoney(selfNet < 0 ? -selfNet : selfNet, locale)}
                    style={{
                      color: summaryColor,
                      fontVariant: ["tabular-nums"]
                    }}
                    variant="monoAmount"
                  >
                    {settled ? t("balance.all_settled") : formatMoney(Math.abs(selfNet), locale)}
                  </Text>
                  {!settled ? (
                    <Text
                      style={{ color: youAreOwed ? colors.positive : colors.negative }}
                      variant="caption"
                    >
                      {t(youAreOwed ? "balance.you_are_owed" : "balance.you_owe")}
                    </Text>
                  ) : null}
                </View>

                {/* Action pills */}
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable
                    accessibilityLabel={t("settle.title")}
                    accessibilityRole="button"
                    onPress={() => router.push(`/group/${groupId}/settle` as Href)}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: colors.brandPrimary,
                      borderRadius: radii.pill,
                      flex: 1,
                      flexDirection: "row",
                      gap: spacing.sm,
                      justifyContent: "center",
                      opacity: pressed ? 0.85 : 1,
                      paddingVertical: spacing.sm
                    })}
                    testID="settle-cta"
                  >
                    <HandCoins color={colors.inkOnBrand} size={16} />
                    <Text style={{ color: colors.inkOnBrand }} variant="label">
                      {t("settle.title")}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={t("groups.detail.action.balances")}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: colors.bgSubtle,
                      borderRadius: radii.pill,
                      flex: 1,
                      flexDirection: "row",
                      gap: spacing.sm,
                      justifyContent: "center",
                      opacity: pressed ? 0.78 : 1,
                      paddingVertical: spacing.sm
                    })}
                  >
                    <Users color={colors.inkPrimary} size={16} />
                    <Text style={{ color: colors.inkPrimary }} variant="label">
                      {t("groups.detail.action.balances")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {expenses.length > 0 ? (
              <View
                style={{
                  paddingBottom: spacing.xs,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.lg
                }}
              >
                <Text
                  style={{
                    color: colors.inkMuted,
                    letterSpacing: 0.4,
                    textTransform: "uppercase"
                  }}
                  variant="label"
                >
                  {t("groups.detail.list.section")}
                </Text>
              </View>
            ) : null}
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing["5xl"] + 60 }}
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelfPayer = session.userId === item.paidBy;
          const payerName = memberLookup.get(item.paidBy) ?? t("common.unknown_user");
          const payerLine = isSelfPayer
            ? t("expense.list.you_paid")
            : t("expense.list.member_paid", { name: payerName });
          return (
            <View
              style={{
                alignItems: "center",
                backgroundColor: colors.bgCanvas,
                flexDirection: "row",
                gap: spacing.md,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: colors.bgSubtle,
                  borderRadius: radii.md,
                  height: 44,
                  justifyContent: "center",
                  width: 44
                }}
              >
                <ReceiptText color={colors.brandPrimary} size={20} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ color: colors.inkPrimary }}
                  variant="bodyStrong"
                >
                  {item.description}
                </Text>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ color: colors.inkMuted }}
                  variant="caption"
                >
                  {`${t(`expense.category.${item.category}`)} · ${formatRelativeDhakaDate(item.occurredAt, locale)}`}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={{ color: colors.inkSecondary }} variant="caption">
                  {payerLine}
                </Text>
                <Text
                  accessibilityLabel={formatMoney(item.amountPaisa, locale)}
                  style={{
                    color: colors.inkPrimary,
                    fontVariant: ["tabular-nums"]
                  }}
                  variant="bodyStrong"
                >
                  {formatMoney(item.amountPaisa, locale)}
                </Text>
              </View>
            </View>
          );
        }}
      />
      <Pressable
        accessibilityLabel={t("expense.add.title")}
        accessibilityRole="button"
        onPress={() => router.push(`/group/${groupId}/add-expense` as Href)}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.brandPrimary,
          borderRadius: radii.pill,
          bottom: spacing.xl,
          elevation: 6,
          height: 60,
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
          position: "absolute",
          right: spacing.xl,
          shadowColor: "#000",
          shadowOffset: { height: 6, width: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          width: 60
        })}
        testID="add-expense-fab-floating"
      >
        <Plus color={colors.bgCanvas} size={28} />
      </Pressable>
    </View>
  );
}
