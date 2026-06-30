import { formatMoney, formatRelativeDhakaDate } from "@baki/i18n";
import { useQueries } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState, Money, Skeleton, Text, radii, spacing, useTheme } from "@baki/ui";

import { GroupTemplateMark } from "@/components/ledger-marks";
import { useSession } from "@/features/auth/use-session";
import { balancesKeys, fetchGroupBalances } from "@/features/balances/use-balances";
import { sumSelfNets } from "@/features/balances/simplify-display";
import { useGroups } from "@/features/groups/use-groups";
import { usePreferencesStore } from "@/stores/preferences";

export default function BalancesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
  const firstGroupId = groups[0]?.id;

  const screenHeader = (
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
          borderColor: colors.borderSubtle,
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
  );

  const addTarget = firstGroupId
    ? (`/group/${firstGroupId}/add-expense` as Href)
    : ("/groups/create" as Href);
  const addLabel = firstGroupId ? t("expense.add.title") : t("groups.create.cta");
  const addExpenseFab = (
    <Pressable
      accessibilityLabel={addLabel}
      accessibilityRole="button"
      onPress={() => router.push(addTarget)}
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
  );

  if (groupsQuery.isPending) {
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
          {screenHeader}
          <Skeleton height={96} style={{ backgroundColor: colors.bgSubtle }} />
          <Skeleton height={72} style={{ backgroundColor: colors.bgSubtle }} />
        </ScrollView>
        {addExpenseFab}
      </View>
    );
  }

  if (groups.length === 0) {
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
          {screenHeader}
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              borderWidth: 1,
              padding: spacing.lg
            }}
          >
            <EmptyState body={t("groups.list.empty.body")} title={t("groups.list.empty.title")} />
          </View>
        </ScrollView>
        {addExpenseFab}
      </View>
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
  const totalTone =
    totalNet < 0 ? colors.negative : totalNet > 0 ? colors.positive : colors.inkSecondary;

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
          {screenHeader}
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
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
            const label = isDebt
              ? t("balance.you_owe")
              : isCredit
                ? t("balance.you_are_owed")
                : t("balance.all_settled");
            return (
              <Pressable
                key={group.id}
                accessibilityRole="button"
                onPress={() => router.push(`/group/${group.id}` as Href)}
                style={{
                  alignItems: "center",
                  backgroundColor: colors.bgSurface,
                  borderBottomColor: colors.rowDivider,
                  borderBottomWidth: 1,
                  flexDirection: "row",
                  gap: spacing.md,
                  minHeight: 76,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm
                }}
              >
                <GroupTemplateMark template={group.template} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkPrimary }}
                    variant="bodyStrong"
                  >
                    {group.name}
                  </Text>
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkMuted }}
                    variant="caption"
                  >
                    {t("groups.list.group_meta", {
                      template: t(`groups.template.${group.template}`),
                      updatedAt: formatRelativeDhakaDate(group.updatedAt, locale)
                    })}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", flexShrink: 0, gap: 2, maxWidth: 140 }}>
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{
                      color: isDebt ? colors.negative : isCredit ? colors.positive : colors.inkMuted
                    }}
                    variant="caption"
                  >
                    {label}
                  </Text>
                  {isDebt || isCredit ? (
                    <Money
                      amountPaisa={net < 0 ? -net : net}
                      locale={locale}
                      style={{
                        color: isDebt ? colors.negative : colors.positive,
                        fontSize: 16,
                        lineHeight: 22
                      }}
                      variant={isDebt ? "negative" : "positive"}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {addExpenseFab}
    </View>
  );
}
