import { useQueries } from "@tanstack/react-query";
import { Link, useRouter, type Href } from "expo-router";
import { Plus, Search, UserPlus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, TextInput, View } from "react-native";

import {
  Avatar,
  Button,
  EmptyState,
  Money,
  Skeleton,
  Text,
  radii,
  spacing,
  useTheme
} from "@baki/ui";

import { useSession } from "@/features/auth/use-session";
import { balancesKeys, fetchGroupBalances } from "@/features/balances/use-balances";
import { useGroups } from "@/features/groups/use-groups";
import { usePreferencesStore } from "@/stores/preferences";

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

  const firstGroupId = groups[0]?.id;
  const groupCount = groups.length;

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <FlatList
        ItemSeparatorComponent={() => (
          <View
            style={{
              backgroundColor: colors.borderSubtle,
              height: 1,
              marginLeft: spacing.lg + 44 + spacing.md,
              marginRight: spacing.lg
            }}
          />
        )}
        ListEmptyComponent={
          groupsQuery.isPending ? (
            <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
              <Skeleton height={72} style={{ backgroundColor: colors.bgSubtle }} />
              <Skeleton height={72} style={{ backgroundColor: colors.bgSubtle }} />
              <Skeleton height={72} style={{ backgroundColor: colors.bgSubtle }} />
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderRadius: radii.lg,
                borderWidth: 1,
                marginHorizontal: spacing.lg,
                padding: spacing.lg
              }}
            >
              <EmptyState
                action={{
                  label: t("groups.create.cta"),
                  onPress: () => router.push("/groups/create" as Href)
                }}
                body={t("groups.list.empty.body")}
                title={t("groups.list.empty.title")}
              />
            </View>
          )
        }
        ListFooterComponent={
          <View style={{ flexDirection: "row", gap: spacing.md, padding: spacing.lg }}>
            <Link asChild href={"/groups/join" as Href}>
              <Button
                accessibilityLabel={t("groups.join.cta")}
                style={{ backgroundColor: colors.bgSubtle, flex: 1 }}
                variant="secondary"
              >
                {t("groups.join.cta")}
              </Button>
            </Link>
            <Link asChild href={"/groups/create" as Href}>
              <Button
                accessibilityLabel={t("groups.create.cta")}
                style={{ backgroundColor: colors.brandPrimary, flex: 1 }}
              >
                {t("groups.create.cta")}
              </Button>
            </Link>
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing["5xl"] }}
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
                backgroundColor: colors.bgCanvas,
                flexDirection: "row",
                gap: spacing.md,
                opacity: pressed ? 0.85 : 1,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md
              })}
              testID={`group-card-${index}`}
            >
              <Avatar name={item.name} size="md" />
              <View style={{ flex: 1, gap: 2, justifyContent: "center" }}>
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
                  {t(`groups.template.${item.template}`)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", flexShrink: 0, gap: 2, maxWidth: 140 }}>
                {balanceLoading ? (
                  // TODO(i18n): replace with `balance.loading` once design-system-engineer
                  // adds it; using the closest existing common.loading copy.
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
          <View style={{ gap: spacing.md, padding: spacing.lg }}>
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
                    {/* TODO(i18n): `groups.list.subtitle.active` not yet in catalogs —
                       reuse the canonical members_count pluralization shape until
                       design-system-engineer adds the dedicated key. */}
                    {t("groups.detail.members_count", { count: groupCount })}
                  </Text>
                ) : null}
              </View>
              <Link asChild href={"/groups/join" as Href}>
                <Pressable
                  accessibilityLabel={t("groups.join.cta")}
                  accessibilityRole="button"
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
              </Link>
            </View>
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
                accessibilityLabel={t("common.search") || t("groups.list.title")}
                accessibilityRole="search"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                /* TODO(i18n): `groups.list.search.placeholder` not yet in catalogs —
                   `common.search` is the orchestrator's interim fallback. */
                placeholder={t("common.search") || t("groups.list.title")}
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
          </View>
        }
      />
      <Pressable
        accessibilityLabel={firstGroupId ? t("expense.add.title") : t("groups.create.cta")}
        accessibilityRole="button"
        onPress={() =>
          router.push(
            firstGroupId
              ? (`/group/${firstGroupId}/add-expense` as Href)
              : ("/groups/create" as Href)
          )
        }
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.brandPrimary,
          borderRadius: radii.pill,
          bottom: spacing["2xl"],
          elevation: 6,
          height: 58,
          justifyContent: "center",
          opacity: pressed ? 0.86 : 1,
          position: "absolute",
          right: spacing.lg,
          shadowColor: colors.bgCanvas,
          shadowOffset: { height: 6, width: 0 },
          shadowOpacity: 0.32,
          shadowRadius: 12,
          width: 58
        })}
        testID="home-add-expense-fab"
      >
        <Plus color={colors.inkOnBrand} size={28} />
      </Pressable>
    </View>
  );
}
