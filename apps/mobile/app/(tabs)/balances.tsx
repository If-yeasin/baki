import { useQueries } from "@tanstack/react-query";
import { formatMoney } from "@baki/i18n";
import { Link, type Href } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState, Money, Skeleton, Text, radii, spacing, useTheme } from "@baki/ui";

import { useSession } from "@/features/auth/use-session";
import { balancesKeys, fetchGroupBalances } from "@/features/balances/use-balances";
import { sumSelfNets } from "@/features/balances/simplify-display";
import { useGroups } from "@/features/groups/use-groups";
import { usePreferencesStore } from "@/stores/preferences";

export default function BalancesScreen() {
  const { t } = useTranslation();
  const locale = usePreferencesStore((state) => state.locale);
  const session = useSession();
  const groupsQuery = useGroups();
  const groups = groupsQuery.data ?? [];
  const { colors } = useTheme();

  const queries = useQueries({
    queries: groups.map((group) => ({
      enabled: Boolean(session.userId),
      queryFn: () => fetchGroupBalances(group.id),
      queryKey: balancesKeys.group(group.id),
      staleTime: 1000 * 30
    }))
  });

  if (groupsQuery.isPending) {
    return (
      <ScrollView
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl }}
        style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
      >
        <Skeleton height={72} style={{ backgroundColor: colors.bgSubtle }} />
        <Skeleton height={120} style={{ backgroundColor: colors.bgSubtle }} />
      </ScrollView>
    );
  }

  if (groups.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl }}
        style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
      >
        <View
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderStrong,
            borderRadius: radii.md,
            borderWidth: 1,
            padding: spacing.lg
          }}
        >
          <EmptyState body={t("groups.list.empty.body")} title={t("groups.list.empty.title")} />
        </View>
      </ScrollView>
    );
  }

  const selfId = session.userId;
  const perGroupNets = queries.map((query, index) => {
    const groupId = groups[index]?.id;
    if (!groupId || !selfId) return 0;
    const rows = query.data ?? [];
    const selfRow = rows.find((row) => row.user_id === selfId);
    return selfRow?.net_paisa ?? 0;
  });

  const totalNet = sumSelfNets(perGroupNets);
  const firstGroupId = groups[0]?.id;
  const totalTone =
    totalNet < 0 ? colors.warning : totalNet > 0 ? colors.brandPrimary : colors.inkSecondary;

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.lg,
          padding: spacing.lg,
          paddingBottom: spacing["5xl"]
        }}
        style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
            <Text style={{ color: colors.inkPrimary, flex: 1 }} variant="h2">
              {t("groups.detail.balances.title")}
            </Text>
            <View
              accessibilityLabel={t("groups.detail.balances.title")}
              accessibilityRole="search"
              style={{
                alignItems: "center",
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderStrong,
                borderRadius: radii.pill,
                borderWidth: 1,
                height: 44,
                justifyContent: "center",
                width: 44
              }}
            >
              <Search color={colors.inkMuted} size={18} />
            </View>
          </View>
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderStrong,
              borderRadius: radii.md,
              borderWidth: 1,
              gap: spacing.sm,
              padding: spacing.lg
            }}
          >
            <Text style={{ color: colors.inkSecondary }} variant="caption">
              {totalNet < 0
                ? t("balance.you_owe")
                : totalNet > 0
                  ? t("balance.you_are_owed")
                  : t("balance.all_settled")}
            </Text>
            <Money
              accessibilityLabel={formatMoney(totalNet < 0 ? -totalNet : totalNet, locale)}
              amountPaisa={totalNet < 0 ? -totalNet : totalNet}
              locale={locale}
              style={{ color: totalTone, fontSize: 30, lineHeight: 38 }}
              variant={totalNet < 0 ? "negative" : totalNet > 0 ? "positive" : "neutral"}
            />
          </View>
        </View>

        <View style={{ overflow: "hidden" }}>
          {groups.map((group, index) => {
            const net = perGroupNets[index] ?? 0;
            const isDebt = net < 0;
            const isCredit = net > 0;
            return (
              <View
                key={group.id}
                style={{
                  alignItems: "center",
                  backgroundColor: colors.bgSurface,
                  borderBottomColor: colors.borderStrong,
                  borderBottomWidth: 1,
                  flexDirection: "row",
                  gap: spacing.md,
                  minHeight: 68,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm
                }}
              >
                <View
                  style={{
                    backgroundColor: isDebt
                      ? colors.warning
                      : isCredit
                        ? colors.brandPrimary
                        : colors.bgSubtle,
                    borderRadius: radii.pill,
                    height: 10,
                    width: 10
                  }}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkPrimary }}
                    variant="bodyStrong"
                  >
                    {group.name}
                  </Text>
                  <Text style={{ color: colors.inkMuted }} variant="caption">
                    {isDebt
                      ? t("balance.you_owe")
                      : isCredit
                        ? t("balance.you_are_owed")
                        : t("balance.all_settled")}
                  </Text>
                </View>
                <Money
                  amountPaisa={net < 0 ? -net : net}
                  locale={locale}
                  style={{
                    color: isDebt
                      ? colors.warning
                      : isCredit
                        ? colors.brandPrimary
                        : colors.inkMuted,
                    fontSize: 16,
                    lineHeight: 22
                  }}
                  variant={isDebt ? "negative" : isCredit ? "positive" : "neutral"}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Link
        asChild
        href={
          firstGroupId ? (`/group/${firstGroupId}/add-expense` as Href) : ("/groups/create" as Href)
        }
      >
        <Pressable
          accessibilityLabel={firstGroupId ? t("expense.add.title") : t("groups.create.cta")}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.brandPrimary,
            borderRadius: radii.pill,
            bottom: spacing["2xl"],
            height: 58,
            justifyContent: "center",
            opacity: pressed ? 0.86 : 1,
            position: "absolute",
            right: spacing.lg,
            width: 58
          })}
          testID="balances-add-expense-fab"
        >
          <Plus color={colors.bgCanvas} size={28} />
        </Pressable>
      </Link>
    </View>
  );
}
