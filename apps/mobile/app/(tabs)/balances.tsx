import { formatMoney, formatRelativeDhakaDate, toBengaliNumerals } from "@baki/i18n";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { ArrowRight, Scale, Search } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { Avatar, Money, Skeleton, Text, radii, spacing, useTheme } from "@baki/ui";

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
  pickCounterparty,
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

type BalanceQueueItem = {
  amountLabel: string;
  counterpartyName: string;
  groupId: string;
  groupName: string;
  sortAmount: number;
  statusLabel: string;
  tone: "negative" | "positive";
};

export default function BalancesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = usePreferencesStore((state) => state.locale);
  const session = useSession();
  const groupsQuery = useGroups();
  const groups = groupsQuery.data ?? [];
  const { colors } = useTheme();
  const [query, setQuery] = useState("");

  const queries = useQueries({
    queries: groups.map((group) => ({
      enabled: Boolean(session.userId),
      queryFn: () => fetchGroupBalances(group.id),
      queryKey: balancesKeys.group(group.id),
      staleTime: 1000 * 30
    }))
  });
  const balanceRowsByGroup = queries.map((query) => query.data ?? []);
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
    queryKey: ["profiles", "balanceCounterparties", counterpartyIds],
    staleTime: 1000 * 60
  });
  const firstGroupId = groups[0]?.id;

  const screenHeader = (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
      <Text style={{ color: colors.inkPrimary, flex: 1 }} variant="h2">
        {t("groups.detail.balances.title")}
      </Text>
    </View>
  );

  if (groupsQuery.isPending) {
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
          {screenHeader}
          <Skeleton height={96} style={{ backgroundColor: colors.bgSubtle }} />
          <Skeleton height={72} style={{ backgroundColor: colors.bgSubtle }} />
        </ScrollView>
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
            paddingBottom: tabScreenBottomInset
          }}
          style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
        >
          {screenHeader}
          <BakiEmptyState
            action={{
              accessibilityLabel: t("groups.create.cta"),
              label: t("groups.create.cta"),
              onPress: () => router.push("/groups/create" as Href)
            }}
            body={t("balances.empty.body")}
            icon={Scale}
            testID="balances-empty-state"
            title={t("balances.empty.title")}
            tone="gold"
          />
        </ScrollView>
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
  const totalReceivePaisa = perGroupNets.reduce((sum, net) => (net > 0 ? sum + net : sum), 0);
  const totalPayPaisa = perGroupNets.reduce((sum, net) => (net < 0 ? sum + Math.abs(net) : sum), 0);
  const firstDebtGroupId = groups.find((group, index) => (perGroupNets[index] ?? 0) < 0)?.id;
  const groupCountLabel = formatDisplayCount(groups.length, locale);
  const totalSettled = totalNet === 0;
  const totalCredit = totalNet > 0;
  const overviewTone = totalSettled ? "settled" : totalCredit ? "positive" : "negative";
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
        testID: "balances-overview-add-expense"
      }
    : undefined;
  const settleAction: LedgerOverviewAction | undefined = firstDebtGroupId
    ? {
        kind: "settle",
        label: t("settle.title"),
        onPress: () => router.push(`/group/${firstDebtGroupId}/settle` as Href),
        testID: "balances-overview-settle"
      }
    : undefined;
  const overviewPrimaryAction = settleAction ?? addExpenseAction;
  const overviewSecondaryAction = settleAction ? addExpenseAction : undefined;
  const profileNameById = new Map(
    (counterpartyProfilesQuery.data ?? []).map((profile) => [profile.id, profile.display_name])
  );
  const searchTerm = query.trim().toLowerCase();
  const nextBalanceAction = buildNextBalanceAction({
    balanceRowsByGroup,
    groups,
    locale,
    perGroupNets,
    profileNameById,
    selfId,
    t
  });
  const balanceQueueItems: BalanceQueueItem[] = groups
    .map((group, index) => {
      const net = perGroupNets[index] ?? 0;
      if (net === 0) return null;

      const counterparty = pickCounterparty(balanceRowsByGroup[index] ?? [], selfId, net);
      if (!counterparty) return null;

      const isDebt = net < 0;
      const counterpartyName =
        profileNameById.get(counterparty.user_id) ?? t("common.unknown_user");

      return {
        amountLabel: formatMoney(Math.abs(net), locale),
        counterpartyName,
        groupId: group.id,
        groupName: group.name,
        sortAmount: Math.abs(net),
        statusLabel: t(isDebt ? "balance.you_owe_name" : "balance.you_are_owed_name", {
          name: counterpartyName
        }),
        tone: isDebt ? "negative" : "positive"
      };
    })
    .filter((item): item is BalanceQueueItem => Boolean(item))
    .sort((a, b) => b.sortAmount - a.sortAmount)
    .slice(0, 3);
  const filteredBalanceRows = groups
    .map((group, index) => ({
      group,
      net: perGroupNets[index] ?? 0
    }))
    .filter(({ group }) => (searchTerm ? group.name.toLowerCase().includes(searchTerm) : true));

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
          {screenHeader}
          {overviewPrimaryAction ? (
            <LedgerOverviewCard
              amountAccessibilityLabel={overviewAmountLabel}
              amountLabel={overviewAmountLabel}
              caption={t("ledger.overview.khatas", { count: groupCountLabel })}
              metrics={overviewMetrics}
              primaryAction={overviewPrimaryAction}
              secondaryAction={overviewSecondaryAction}
              statusLabel={
                totalSettled
                  ? t("ledger.overview.settled")
                  : t(totalCredit ? "balance.you_are_owed" : "balance.you_owe")
              }
              title={t("groups.list.total_balance")}
              tone={overviewTone}
            />
          ) : null}
          {nextBalanceAction && balanceQueueItems.length <= 1 && !searchTerm ? (
            <NextBalanceActionCard
              action={nextBalanceAction}
              onPress={() =>
                router.push(
                  nextBalanceAction.tone === "negative"
                    ? (`/group/${nextBalanceAction.groupId}/settle` as Href)
                    : (`/group/${nextBalanceAction.groupId}` as Href)
                )
              }
              testID="balances-next-action"
            />
          ) : null}
          {balanceQueueItems.length > 1 && !searchTerm ? (
            <BalanceQueueCard
              items={balanceQueueItems}
              onSelect={(item) =>
                router.push(
                  item.tone === "negative"
                    ? (`/group/${item.groupId}/settle` as Href)
                    : (`/group/${item.groupId}` as Href)
                )
              }
            />
          ) : null}
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
              testID="balances-search-input"
              value={query}
            />
          </View>
        </View>

        {filteredBalanceRows.length > 0 ? (
          <View style={{ overflow: "hidden" }}>
            {filteredBalanceRows.map(({ group, net }) => {
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
                  testID={`balances-group-row-${group.id}`}
                >
                  <GroupTemplateMark template={group.template} />
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
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
                        color: isDebt
                          ? colors.negative
                          : isCredit
                            ? colors.positive
                            : colors.inkMuted
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
        ) : (
          <BakiEmptyState
            action={{
              accessibilityLabel: t("common.clear_search"),
              label: t("common.clear_search"),
              onPress: () => setQuery(""),
              variant: "secondary"
            }}
            body={t("groups.list.search.empty.body")}
            icon={Search}
            testID="balances-search-empty-state"
            title={t("groups.list.search.empty.title")}
            tone="neutral"
          />
        )}
      </ScrollView>
    </View>
  );
}

function BalanceQueueCard({
  items,
  onSelect
}: {
  items: BalanceQueueItem[];
  onSelect: (item: BalanceQueueItem) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderColor: colors.borderSubtle,
        borderRadius: radii.md,
        borderWidth: 1,
        overflow: "hidden"
      }}
      testID="balances-person-queue"
    >
      <View style={{ gap: 2, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <Text style={{ color: colors.inkPrimary }} variant="bodyStrong">
          {t("balances.queue.title")}
        </Text>
        <Text tone="muted" variant="caption">
          {t("balances.queue.subtitle")}
        </Text>
      </View>

      {items.map((item, index) => (
        <BalanceQueueRow
          isLast={index === items.length - 1}
          item={item}
          key={`${item.groupId}-${item.counterpartyName}`}
          onPress={() => onSelect(item)}
        />
      ))}
    </View>
  );
}

function BalanceQueueRow({
  isLast,
  item,
  onPress
}: {
  isLast: boolean;
  item: BalanceQueueItem;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const toneColor = item.tone === "negative" ? colors.negative : colors.positive;
  const tintColor = item.tone === "negative" ? colors.tintNegative : colors.tintPositive;

  return (
    <Pressable
      accessibilityLabel={`${item.statusLabel}. ${item.groupName}. ${item.amountLabel}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        borderBottomColor: colors.rowDivider,
        borderBottomWidth: isLast ? 0 : 1,
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 68,
        opacity: pressed ? 0.78 : 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm
      })}
    >
      <Avatar name={item.counterpartyName} size="sm" />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{ color: colors.inkPrimary }}
          variant="bodyStrong"
        >
          {item.statusLabel}
        </Text>
        <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="caption">
          {item.groupName}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", flexShrink: 0, gap: spacing.xs, maxWidth: 116 }}>
        <View
          style={{
            backgroundColor: tintColor,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2
          }}
        >
          <Text style={{ color: toneColor }} variant="label">
            {item.amountLabel}
          </Text>
        </View>
        <ArrowRight color={colors.inkMuted} size={16} />
      </View>
    </Pressable>
  );
}
