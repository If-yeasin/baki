import { formatMoney, formatRelativeDhakaDate, toBengaliNumerals } from "@baki/i18n";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useRouter, type Href } from "expo-router";
import { BookOpenCheck, Plus, Search, UserPlus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, TextInput, View } from "react-native";

import { Button, Money, Skeleton, Text, radii, spacing, useTheme } from "@baki/ui";

import { BakiEmptyState } from "@/components/baki-empty-state";
import { GroupTemplateMark } from "@/components/ledger-marks";
import {
  LedgerOverviewCard,
  type LedgerOverviewAction,
  type LedgerOverviewMetric
} from "@/components/ledger-overview-card";
import { NextBalanceActionCard } from "@/components/next-balance-action-card";
import { useSession } from "@/features/auth/use-session";
import {
  buildNextBalanceAction,
  getCounterpartyIds,
  type BalanceCounterpartyProfile
} from "@/features/balances/next-balance-action";
import { balancesKeys, fetchGroupBalances } from "@/features/balances/use-balances";
import { sumSelfNets } from "@/features/balances/simplify-display";
import { useGroups } from "@/features/groups/use-groups";
import { tabScreenBottomInset } from "@/lib/layout";
import { supabase } from "@/lib/supabase";
import { usePreferencesStore } from "@/stores/preferences";

function formatDisplayCount(count: number, locale: string): string {
  return locale === "bn" ? toBengaliNumerals(count) : String(count);
}

export default function GroupsListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const groupsQuery = useGroups();
  const groups = groupsQuery.data ?? [];
  const { colors } = useTheme();
  const session = useSession();
  const locale = usePreferencesStore((state) => state.locale);
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(q));
  }, [groups, query]);

  // Per-group self-net. Mirrors the pattern in balances.tsx so we don't invent
  // a new aggregate query — TanStack dedupes by queryKey, so the cost is one
  // RPC per group with cache reuse.
  const balanceQueries = useQueries({
    queries: groups.map((group) => ({
      enabled: Boolean(session.userId),
      queryFn: () => fetchGroupBalances(group.id),
      queryKey: balancesKeys.group(group.id),
      staleTime: 1000 * 30
    }))
  });
  const balanceRowsByGroup = balanceQueries.map((query) => query.data ?? []);
  const counterpartyIds = getCounterpartyIds({
    balanceRowsByGroup,
    groups,
    selfId: session.userId
  });
  const counterpartyProfilesQuery = useQuery({
    enabled: counterpartyIds.length > 0,
    queryFn: async (): Promise<BalanceCounterpartyProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", counterpartyIds);

      if (error) throw error;

      return data ?? [];
    },
    queryKey: ["profiles", "homeBalanceCounterparties", counterpartyIds],
    staleTime: 1000 * 60
  });

  const selfNetByGroup = useMemo(() => {
    const map = new Map<string, { loading: boolean; netPaisa: number }>();
    if (!session.userId) return map;
    groups.forEach((group, index) => {
      const q = balanceQueries[index];
      const rows = q?.data ?? [];
      const selfRow = rows.find((row) => row.user_id === session.userId);
      map.set(group.id, {
        loading: Boolean(q?.isPending && !q.data),
        netPaisa: selfRow?.net_paisa ?? 0
      });
    });
    return map;
  }, [balanceQueries, groups, session.userId]);

  const totalNet = useMemo(
    () => sumSelfNets(Array.from(selfNetByGroup.values()).map((entry) => entry.netPaisa)),
    [selfNetByGroup]
  );
  const totalReceivePaisa = useMemo(
    () =>
      Array.from(selfNetByGroup.values()).reduce(
        (sum, entry) => (entry.netPaisa > 0 ? sum + entry.netPaisa : sum),
        0
      ),
    [selfNetByGroup]
  );
  const totalPayPaisa = useMemo(
    () =>
      Array.from(selfNetByGroup.values()).reduce(
        (sum, entry) => (entry.netPaisa < 0 ? sum + Math.abs(entry.netPaisa) : sum),
        0
      ),
    [selfNetByGroup]
  );

  const firstGroupId = groups[0]?.id;
  const firstDebtGroupId = groups.find((group) => {
    const entry = selfNetByGroup.get(group.id);
    return (entry?.netPaisa ?? 0) < 0;
  })?.id;
  const groupCount = groups.length;
  const groupCountLabel = formatDisplayCount(groupCount, locale);
  const totalSettled = totalNet === 0;
  const totalCredit = totalNet > 0;
  const overviewTone = totalSettled ? "settled" : totalCredit ? "positive" : "negative";
  const overviewStatusLabel = totalSettled
    ? t("ledger.overview.settled")
    : t(totalCredit ? "balance.you_are_owed" : "balance.you_owe");
  const overviewAmountLabel = formatMoney(Math.abs(totalNet), locale);
  const overviewMetrics: [LedgerOverviewMetric, LedgerOverviewMetric] = [
    {
      amountAccessibilityLabel: formatMoney(totalReceivePaisa, locale),
      amountLabel: formatMoney(totalReceivePaisa, locale),
      label: t("ledger.overview.receive"),
      tone: "positive"
    },
    {
      amountAccessibilityLabel: formatMoney(totalPayPaisa, locale),
      amountLabel: formatMoney(totalPayPaisa, locale),
      label: t("ledger.overview.pay"),
      tone: "negative"
    }
  ];
  const addExpenseAction: LedgerOverviewAction | undefined = firstGroupId
    ? {
        kind: "add",
        label: t("expense.add.title"),
        onPress: () => router.push(`/group/${firstGroupId}/add-expense` as Href),
        testID: "home-overview-add-expense"
      }
    : undefined;
  const viewBalancesAction: LedgerOverviewAction = {
    kind: "balances",
    label: t("groups.detail.action.balances"),
    onPress: () => router.push("/balances" as Href),
    testID: "home-overview-balances"
  };
  const settleAction: LedgerOverviewAction | undefined = firstDebtGroupId
    ? {
        kind: "settle",
        label: t("settle.title"),
        onPress: () => router.push(`/group/${firstDebtGroupId}/settle` as Href),
        testID: "home-overview-settle"
      }
    : undefined;
  const overviewPrimaryAction = settleAction ?? addExpenseAction ?? viewBalancesAction;
  const overviewSecondaryAction =
    overviewPrimaryAction.kind === "settle" ? addExpenseAction : viewBalancesAction;
  const profileNameById = new Map(
    (counterpartyProfilesQuery.data ?? []).map((profile) => [profile.id, profile.display_name])
  );
  const perGroupNets = groups.map((group) => selfNetByGroup.get(group.id)?.netPaisa ?? 0);
  const searchTerm = query.trim().toLowerCase();
  const nextBalanceAction = buildNextBalanceAction({
    balanceRowsByGroup,
    groups,
    locale,
    perGroupNets,
    profileNameById,
    selfId: session.userId,
    t
  });

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <FlatList
        ItemSeparatorComponent={() => (
          <View
            style={{
              backgroundColor: colors.borderSubtle,
              height: 1,
              marginLeft: spacing.lg + 48 + spacing.md,
              marginRight: spacing.lg
            }}
          />
        )}
        ListEmptyComponent={
          groupsQuery.isPending ? (
            <View
              style={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
            >
              <Skeleton height={72} style={{ backgroundColor: colors.bgSubtle }} />
              <Skeleton height={72} style={{ backgroundColor: colors.bgSubtle }} />
              <Skeleton height={72} style={{ backgroundColor: colors.bgSubtle }} />
            </View>
          ) : groupCount > 0 && query.trim().length > 0 ? (
            <BakiEmptyState
              action={{
                accessibilityLabel: t("common.clear_search"),
                label: t("common.clear_search"),
                onPress: () => setQuery(""),
                variant: "secondary"
              }}
              body={t("groups.list.search.empty.body")}
              icon={Search}
              style={{ marginHorizontal: spacing.lg }}
              testID="groups-search-empty-state"
              title={t("groups.list.search.empty.title")}
              tone="neutral"
            />
          ) : (
            <BakiEmptyState
              action={{
                accessibilityLabel: t("groups.create.cta"),
                label: t("groups.create.cta"),
                onPress: () => router.push("/groups/create" as Href)
              }}
              body={t("groups.list.empty.body")}
              icon={BookOpenCheck}
              style={{ marginHorizontal: spacing.lg }}
              testID="groups-empty-state"
              title={t("groups.list.empty.title")}
            />
          )
        }
        ListFooterComponent={
          groups.length > 0 ? (
            <View style={{ height: spacing["3xl"] }} />
          ) : (
            <View style={{ padding: spacing.lg, paddingTop: spacing.xl }}>
              <Link asChild href={"/groups/join" as Href}>
                <Button accessibilityLabel={t("groups.join.cta")} variant="secondary">
                  {t("groups.join.cta")}
                </Button>
              </Link>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: tabScreenBottomInset }}
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ index, item }) => {
          const entry = selfNetByGroup.get(item.id);
          const net = entry?.netPaisa ?? 0;
          const balanceLoading = entry?.loading ?? false;
          const settled = net === 0;
          const youAreOwed = net > 0;
          const balanceTone = settled
            ? colors.inkMuted
            : youAreOwed
              ? colors.positive
              : colors.negative;
          const balanceLabel = settled
            ? t("balance.all_settled")
            : youAreOwed
              ? t("balance.you_are_owed")
              : t("balance.you_owe");

          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/group/${item.id}` as Href)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: colors.bgSurface,
                flexDirection: "row",
                gap: spacing.md,
                minHeight: 76,
                opacity: pressed ? 0.85 : 1,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm
              })}
              testID={`group-card-${index}`}
            >
              <GroupTemplateMark template={item.template} />
              <View style={{ flex: 1, gap: 2, justifyContent: "center", minWidth: 0 }}>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ color: colors.inkPrimary }}
                  variant="bodyStrong"
                >
                  {item.name}
                </Text>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ color: colors.inkMuted }}
                  variant="caption"
                >
                  {t("groups.list.group_meta", {
                    template: t(`groups.template.${item.template}`),
                    updatedAt: formatRelativeDhakaDate(item.updatedAt, locale)
                  })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", flexShrink: 0, gap: 2, maxWidth: 140 }}>
                {balanceLoading ? (
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkMuted }}
                    variant="caption"
                  >
                    {t("common.loading")}
                  </Text>
                ) : (
                  <>
                    <Text
                      ellipsizeMode="tail"
                      numberOfLines={1}
                      style={{ color: colors.inkMuted }}
                      variant="caption"
                    >
                      {balanceLabel}
                    </Text>
                    {settled ? null : (
                      <Money
                        amountPaisa={net < 0 ? -net : net}
                        locale={locale}
                        style={{
                          color: balanceTone,
                          fontSize: 16,
                          lineHeight: 22
                        }}
                        variant={youAreOwed ? "positive" : "negative"}
                      />
                    )}
                  </>
                )}
              </View>
            </Pressable>
          );
        }}
        style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.md }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.inkPrimary }} variant="h2">
                  {t("groups.list.title")}
                </Text>
                {groupCount > 0 ? (
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkMuted }}
                    variant="caption"
                  >
                    {t("groups.list.active_count", { count: groupCountLabel })}
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  accessibilityLabel={t("groups.join.cta")}
                  accessibilityRole="button"
                  onPress={() => router.push("/groups/join" as Href)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    height: 44,
                    justifyContent: "center",
                    opacity: pressed ? 0.82 : 1,
                    width: 44
                  })}
                >
                  <UserPlus color={colors.brandPrimary} size={20} />
                </Pressable>
                <Pressable
                  accessibilityLabel={t("groups.create.cta")}
                  accessibilityRole="button"
                  onPress={() => router.push("/groups/create" as Href)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    height: 44,
                    justifyContent: "center",
                    opacity: pressed ? 0.84 : 1,
                    width: 44
                  })}
                >
                  <Plus color={colors.brandPrimary} size={21} />
                </Pressable>
              </View>
            </View>
            {groupCount > 0 ? (
              <LedgerOverviewCard
                amountAccessibilityLabel={overviewAmountLabel}
                amountLabel={overviewAmountLabel}
                caption={t("ledger.overview.khatas", { count: groupCountLabel })}
                metrics={overviewMetrics}
                primaryAction={overviewPrimaryAction}
                secondaryAction={overviewSecondaryAction}
                statusLabel={overviewStatusLabel}
                title={t("groups.list.total_balance")}
                tone={overviewTone}
              />
            ) : null}
            {nextBalanceAction && !searchTerm ? (
              <NextBalanceActionCard
                action={nextBalanceAction}
                onPress={() =>
                  router.push(
                    nextBalanceAction.tone === "negative"
                      ? (`/group/${nextBalanceAction.groupId}/settle` as Href)
                      : (`/group/${nextBalanceAction.groupId}` as Href)
                  )
                }
                testID="home-next-action"
              />
            ) : null}
            {groupCount > 0 ? (
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
                  placeholder={t("groups.list.search.placeholder")}
                  placeholderTextColor={colors.inkMuted}
                  returnKeyType="search"
                  style={{
                    color: colors.inkPrimary,
                    flex: 1,
                    fontFamily: "HindSiliguri_400Regular",
                    fontSize: 15,
                    paddingVertical: 0
                  }}
                  testID="groups-search-input"
                  value={query}
                />
              </View>
            ) : null}
          </View>
        }
      />
    </View>
  );
}
