import { formatMoney, formatRelativeDhakaDate, toBengaliNumerals } from "@baki/i18n";
import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Plus,
  ReceiptText,
  Users
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, View } from "react-native";

import { Avatar, Skeleton, Text, Toast, radii, spacing, useTheme } from "@baki/ui";

import { BakiEmptyState } from "@/components/baki-empty-state";
import {
  GroupBalanceActionCard,
  type GroupBalanceAction
} from "@/components/group-balance-action-card";
import { ExpenseCategoryMark } from "@/components/ledger-marks";
import { useSession } from "@/features/auth/use-session";
import {
  buildSelfBalanceSummary,
  type BalanceDisplayRow
} from "@/features/balances/simplify-display";
import { useGroupBalances } from "@/features/balances/use-balances";
import { useExpenses } from "@/features/expenses/use-expenses";
import { useGroupDetail, type GroupMemberProfile } from "@/features/groups/use-group-detail";
import { usePreferencesStore } from "@/stores/preferences";

function formatDisplayCount(count: number, locale: string): string {
  return locale === "bn" ? toBengaliNumerals(count) : String(count);
}

export default function GroupDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = usePreferencesStore((state) => state.locale);
  const session = useSession();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id;
  const { colors } = useTheme();
  const [inviteNotice, setInviteNotice] = useState<{
    bodyKey?: string;
    titleKey: string;
    variant: "error" | "success";
  } | null>(null);

  const detailQuery = useGroupDetail(groupId);
  const expensesQuery = useExpenses(groupId);
  const balancesQuery = useGroupBalances(groupId);

  const expenses = expensesQuery.data ?? [];
  const group = detailQuery.data?.group;
  const groupName = group?.name ?? t("groups.detail.fallback_title");
  const inviteCode = group?.inviteCode ? group.inviteCode.toUpperCase() : "";
  const memberCount = detailQuery.data?.members.length ?? 0;
  const memberCountLabel = formatDisplayCount(memberCount, locale);
  const memberCountText = t(
    memberCount === 1 ? "groups.detail.members_count_one" : "groups.detail.members_count",
    { count: memberCountLabel }
  );
  const expenseCountLabel = formatDisplayCount(expenses.length, locale);
  const totalSpentLabel = formatMoney(
    expenses.reduce((total, expense) => total + expense.amountPaisa, 0),
    locale
  );
  const latestExpenseLabel = expenses[0]
    ? formatRelativeDhakaDate(expenses[0].occurredAt, locale)
    : t("groups.detail.summary.none");
  const memberLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of detailQuery.data?.members ?? []) {
      map.set(member.userId, member.displayName);
    }
    return map;
  }, [detailQuery.data]);

  const balanceSummary = useMemo(() => {
    if (!session.userId) return { netPaisa: 0, rows: [] };
    return buildSelfBalanceSummary(
      balancesQuery.data ?? [],
      session.userId,
      (userId) => memberLookup.get(userId),
      t("common.unknown_user")
    );
  }, [balancesQuery.data, memberLookup, session.userId, t]);

  const selfNet = balanceSummary.netPaisa;
  const nextBalance = balanceSummary.rows.find((row) => row.netPaisa !== 0);
  const visibleBalanceRows = balanceSummary.rows.filter((row) => row.netPaisa !== 0).slice(0, 3);
  const settled = selfNet === 0;
  const youAreOwed = selfNet > 0;
  const summaryTone = settled ? "settled" : youAreOwed ? "positive" : "negative";
  const nextStatusLabel = settled
    ? t("groups.detail.next.settled")
    : nextBalance
      ? t(nextBalance.netPaisa > 0 ? "balance.you_are_owed_name" : "balance.you_owe_name", {
          name: nextBalance.counterpartyName
        })
      : t(youAreOwed ? "balance.you_are_owed" : "balance.you_owe");
  const nextAmountLabel = settled
    ? undefined
    : formatMoney(Math.abs(nextBalance?.netPaisa ?? selfNet), locale);
  const amountLabel = settled ? t("balance.all_settled") : formatMoney(Math.abs(selfNet), locale);
  const amountAccessibilityLabel = formatMoney(Math.abs(selfNet), locale);
  const addExpenseAction: GroupBalanceAction = {
    kind: "add",
    label: t("expense.add.title"),
    onPress: () => router.push(`/group/${groupId}/add-expense` as Href),
    testID: "add-expense-header-cta"
  };
  const balancesAction: GroupBalanceAction = {
    kind: "balances",
    label: t("groups.detail.action.balances"),
    onPress: () => router.push("/balances" as Href),
    testID: "balances-cta"
  };
  const settleAction: GroupBalanceAction = {
    kind: "settle",
    label: t("settle.title"),
    onPress: () => router.push(`/group/${groupId}/settle` as Href),
    testID: "settle-cta"
  };
  const primaryAction = settled ? addExpenseAction : selfNet < 0 ? settleAction : balancesAction;
  const secondaryAction = settled
    ? balancesAction
    : selfNet < 0
      ? addExpenseAction
      : addExpenseAction;
  const showFloatingAddExpense = primaryAction.kind !== "add" && secondaryAction.kind !== "add";

  async function handleCopyInviteCode() {
    if (!inviteCode) return;

    try {
      await Clipboard.setStringAsync(inviteCode);
      setInviteNotice({
        bodyKey: "groups.invite.copied.body",
        titleKey: "groups.invite.copied.title",
        variant: "success"
      });
    } catch {
      setInviteNotice({ titleKey: "common.error.generic", variant: "error" });
    }
  }

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
            <View
              style={{ gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.md }}
            >
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </View>
          ) : (
            <View style={{ gap: spacing.md, padding: spacing.xl, paddingTop: spacing.md }}>
              {inviteCode ? (
                <NewGroupStarterCard
                  addExpenseLabel={t("expense.add.title")}
                  code={inviteCode}
                  onAddExpense={() => router.push(`/group/${groupId}/add-expense` as Href)}
                  onCopyInvite={handleCopyInviteCode}
                />
              ) : null}
              <BakiEmptyState
                action={
                  inviteCode
                    ? undefined
                    : {
                        accessibilityLabel: t("expense.add.title"),
                        label: t("expense.add.title"),
                        onPress: () => router.push(`/group/${groupId}/add-expense` as Href)
                      }
                }
                body={t("groups.detail.empty.expenses.body")}
                icon={ReceiptText}
                testID="group-expenses-empty-state"
                title={t("groups.detail.empty.expenses.title")}
                tone="gold"
              />
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
                backgroundColor: colors.brandPrimary,
                borderBottomColor: colors.brandPrimaryPressed,
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
                  <ArrowLeft color={colors.inkOnBrand} size={22} />
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
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <Text
                      ellipsizeMode="tail"
                      numberOfLines={2}
                      style={{ color: colors.inkOnBrand }}
                      variant="h2"
                    >
                      {groupName}
                    </Text>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.xs }}>
                      <Users color={colors.inkOnBrand} size={12} />
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        style={{ color: colors.inkOnBrand, flexShrink: 1, opacity: 0.82 }}
                        variant="caption"
                      >
                        {memberCount > 0
                          ? memberCountText
                          : detailQuery.data
                            ? t(`groups.template.${detailQuery.data.group.template}`)
                            : ""}
                      </Text>
                    </View>
                  </View>
                </View>

                {detailQuery.data?.members.length ? (
                  <GroupMembersStrip
                    code={inviteCode}
                    countLabel={memberCountText}
                    currentUserId={session.userId}
                    inviteCopyLabel={t("groups.invite.copy.cta")}
                    inviteLabel={t("groups.invite.code.label")}
                    locale={locale}
                    members={detailQuery.data.members}
                    onCopyInvite={handleCopyInviteCode}
                  />
                ) : inviteCode ? (
                  <GroupInviteInfoCard
                    code={inviteCode}
                    copyLabel={t("groups.invite.copy.cta")}
                    label={t("groups.invite.code.label")}
                    onCopy={handleCopyInviteCode}
                  />
                ) : null}

                <GroupBalanceActionCard
                  amountAccessibilityLabel={amountAccessibilityLabel}
                  amountLabel={amountLabel}
                  overallLabel={t("groups.detail.overall")}
                  primaryAction={primaryAction}
                  secondaryAction={secondaryAction}
                  statusAmountLabel={nextAmountLabel}
                  statusLabel={nextStatusLabel}
                  statusTitle={t("groups.detail.next.title")}
                  tone={summaryTone}
                />
              </View>
            </View>

            {inviteNotice ? (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                <Toast
                  dismissLabel={t("common.dismiss")}
                  message={inviteNotice.bodyKey ? t(inviteNotice.bodyKey) : undefined}
                  onDismiss={() => setInviteNotice(null)}
                  testID="group-invite-notice"
                  title={t(inviteNotice.titleKey)}
                  variant={inviteNotice.variant}
                />
              </View>
            ) : null}

            {expenses.length > 0 ? (
              <View
                style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}
              >
                <View
                  style={{
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: spacing.sm,
                    padding: spacing.md
                  }}
                  testID="group-ledger-summary"
                >
                  <GroupMetric
                    label={t("groups.detail.summary.totalSpent")}
                    value={totalSpentLabel}
                  />
                  <GroupMetric
                    label={t("groups.detail.summary.entries")}
                    value={t("groups.detail.summary.entriesValue", {
                      count: expenseCountLabel
                    })}
                  />
                  <GroupMetric
                    label={t("groups.detail.summary.latest")}
                    value={latestExpenseLabel}
                  />
                </View>
                <Text
                  style={{
                    color: colors.inkMuted,
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
        ListFooterComponent={
          expenses.length > 0 ? (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg
              }}
            >
              <GroupPeopleBalancePreview groupId={groupId} rows={visibleBalanceRows} />
            </View>
          ) : null
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
                backgroundColor: colors.bgSurface,
                flexDirection: "row",
                gap: spacing.md,
                minHeight: 72,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.sm
              }}
            >
              <ExpenseCategoryMark category={item.category} />
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
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
              <View style={{ alignItems: "flex-end", gap: 2, maxWidth: 132 }}>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ color: colors.inkSecondary }}
                  variant="caption"
                >
                  {payerLine}
                </Text>
                <Text
                  accessibilityLabel={formatMoney(item.amountPaisa, locale)}
                  ellipsizeMode="tail"
                  numberOfLines={1}
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
      {showFloatingAddExpense ? (
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
      ) : null}
    </View>
  );
}

function GroupMembersStrip({
  code,
  countLabel,
  currentUserId,
  inviteCopyLabel,
  inviteLabel,
  locale,
  members,
  onCopyInvite
}: {
  code: string;
  countLabel: string;
  currentUserId: string | null;
  inviteCopyLabel: string;
  inviteLabel: string;
  locale: string;
  members: GroupMemberProfile[];
  onCopyInvite: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const visibleMembers = members.slice(0, 3);
  const moreCount = Math.max(members.length - visibleMembers.length, 0);

  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.14)",
        borderColor: "rgba(255,255,255,0.24)",
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing.sm,
        padding: spacing.md
      }}
      testID="group-members-strip"
    >
      {code ? (
        <GroupInviteRow
          code={code}
          copyLabel={inviteCopyLabel}
          label={inviteLabel}
          onCopy={onCopyInvite}
        />
      ) : null}

      {code ? (
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.18)",
            height: 1
          }}
        />
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <Text style={{ color: colors.inkOnBrand }} variant="label">
            {t("groups.detail.members.title")}
          </Text>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: colors.inkOnBrand, opacity: 0.76 }}
            variant="caption"
          >
            {countLabel}
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {visibleMembers.map((member) => {
            const isCurrentUser = currentUserId === member.userId;
            const roleKey =
              member.role.toLowerCase() === "admin" || member.role.toLowerCase() === "owner"
                ? "groups.detail.members.admin"
                : "groups.detail.members.member";

            return (
              <View
                key={member.userId}
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.16)",
                  borderColor: "rgba(255,255,255,0.24)",
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: spacing.xs,
                  maxWidth: 188,
                  minHeight: 40,
                  paddingLeft: 4,
                  paddingRight: spacing.sm
                }}
              >
                <Avatar name={member.displayName} size="sm" />
                <View style={{ gap: 0, minWidth: 0 }}>
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkOnBrand, maxWidth: 124 }}
                    variant="caption"
                  >
                    {member.displayName}
                  </Text>
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkOnBrand, maxWidth: 124, opacity: 0.72 }}
                    variant="label"
                  >
                    {isCurrentUser
                      ? t("groups.detail.members.youRole", { role: t(roleKey) })
                      : t(roleKey)}
                  </Text>
                </View>
              </View>
            );
          })}

          {moreCount > 0 ? (
            <View
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.16)",
                borderColor: "rgba(255,255,255,0.24)",
                borderRadius: radii.pill,
                borderWidth: 1,
                justifyContent: "center",
                minHeight: 40,
                paddingHorizontal: spacing.md
              }}
            >
              <Text style={{ color: colors.inkOnBrand }} variant="label">
                {t("groups.detail.members.more", {
                  count: formatDisplayCount(moreCount, locale)
                })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function GroupInviteInfoCard({
  code,
  copyLabel,
  label,
  onCopy
}: {
  code: string;
  copyLabel: string;
  label: string;
  onCopy: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.14)",
        borderColor: "rgba(255,255,255,0.24)",
        borderRadius: radii.md,
        borderWidth: 1,
        padding: spacing.md
      }}
      testID="group-members-strip"
    >
      <GroupInviteRow code={code} copyLabel={copyLabel} label={label} onCopy={onCopy} />
    </View>
  );
}

function GroupInviteRow({
  code,
  copyLabel,
  label,
  onCopy
}: {
  code: string;
  copyLabel: string;
  label: string;
  onCopy: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing.sm,
        minHeight: 40
      }}
      testID="group-invite-code-card"
    >
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text style={{ color: colors.inkOnBrand, opacity: 0.78 }} variant="label">
          {label}
        </Text>
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          selectable
          style={{ color: colors.inkOnBrand, fontVariant: ["tabular-nums"] }}
          variant="bodyStrong"
        >
          {code}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={copyLabel}
        accessibilityRole="button"
        onPress={onCopy}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.2)",
          borderRadius: radii.pill,
          flexDirection: "row",
          gap: spacing.xs,
          minHeight: 34,
          opacity: pressed ? 0.72 : 1,
          paddingHorizontal: spacing.md
        })}
        testID="group-invite-copy-button"
      >
        <Copy color={colors.inkOnBrand} size={15} />
        <Text style={{ color: colors.inkOnBrand }} variant="label">
          {copyLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function NewGroupStarterCard({
  addExpenseLabel,
  code,
  onAddExpense,
  onCopyInvite
}: {
  addExpenseLabel: string;
  code: string;
  onAddExpense: () => void;
  onCopyInvite: () => void;
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
        gap: spacing.md,
        padding: spacing.lg
      }}
      testID="new-group-starter-card"
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.tintBrand,
            borderRadius: radii.md,
            height: 44,
            justifyContent: "center",
            width: 44
          }}
        >
          <CheckCircle2 color={colors.brandPrimary} size={22} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
          <Text style={{ color: colors.inkPrimary }} variant="bodyStrong">
            {t("groups.detail.starter.title")}
          </Text>
          <Text
            ellipsizeMode="tail"
            numberOfLines={2}
            style={{ color: colors.inkSecondary }}
            variant="caption"
          >
            {t("groups.detail.starter.body")}
          </Text>
        </View>
      </View>

      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.bgSubtle,
          borderRadius: radii.md,
          flexDirection: "row",
          gap: spacing.sm,
          minHeight: 46,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm
        }}
      >
        <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <Text tone="muted" variant="label">
            {t("groups.invite.code.label")}
          </Text>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            selectable
            style={{ color: colors.inkPrimary, fontVariant: ["tabular-nums"] }}
            variant="bodyStrong"
          >
            {code}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          accessibilityLabel={t("groups.detail.starter.copy")}
          accessibilityRole="button"
          onPress={onCopyInvite}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.brandPrimary,
            borderRadius: radii.pill,
            flex: 1,
            flexDirection: "row",
            gap: spacing.sm,
            justifyContent: "center",
            minHeight: 44,
            minWidth: 0,
            opacity: pressed ? 0.82 : 1,
            paddingHorizontal: spacing.sm
          })}
          testID="new-group-primary-copy"
        >
          <Copy color={colors.inkOnBrand} size={16} />
          <Text
            ellipsizeMode="tail"
            numberOfLines={2}
            style={{ color: colors.inkOnBrand, flexShrink: 1, textAlign: "center" }}
            variant="label"
          >
            {t("groups.detail.starter.copy")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={addExpenseLabel}
          accessibilityRole="button"
          onPress={onAddExpense}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.bgSubtle,
            borderColor: colors.borderSubtle,
            borderRadius: radii.pill,
            borderWidth: 1,
            flex: 1,
            flexDirection: "row",
            gap: spacing.sm,
            justifyContent: "center",
            minHeight: 44,
            minWidth: 0,
            opacity: pressed ? 0.82 : 1,
            paddingHorizontal: spacing.sm
          })}
          testID="new-group-add-expense"
        >
          <Plus color={colors.inkPrimary} size={16} />
          <Text
            ellipsizeMode="tail"
            numberOfLines={2}
            style={{ color: colors.inkPrimary, flexShrink: 1, textAlign: "center" }}
            variant="label"
          >
            {addExpenseLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function GroupMetric({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
      <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="label">
        {label}
      </Text>
      <Text
        ellipsizeMode="tail"
        numberOfLines={1}
        style={{ color: colors.inkPrimary, fontVariant: ["tabular-nums"] }}
        variant="bodyStrong"
      >
        {value}
      </Text>
    </View>
  );
}

function GroupPeopleBalancePreview({
  groupId,
  rows
}: {
  groupId: string;
  rows: BalanceDisplayRow[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
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
      testID="group-people-balance-preview"
    >
      <View
        style={{
          gap: 2,
          paddingBottom: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md
        }}
      >
        <Text style={{ color: colors.inkPrimary }} variant="bodyStrong">
          {t("groups.detail.people.title")}
        </Text>
        <Text tone="muted" variant="caption">
          {t("groups.detail.people.subtitle")}
        </Text>
      </View>

      {rows.length > 0 ? (
        rows.map((row, index) => (
          <PeopleBalanceRow
            isLast={index === rows.length - 1}
            key={row.counterpartyId}
            onSettle={() => router.push(`/group/${groupId}/settle` as Href)}
            row={row}
          />
        ))
      ) : (
        <View style={{ padding: spacing.md, paddingTop: spacing.sm }}>
          <View
            style={{
              backgroundColor: colors.bgSubtle,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm
            }}
          >
            <Text style={{ color: colors.inkSecondary }} variant="caption">
              {t("groups.detail.people.settled")}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function PeopleBalanceRow({
  isLast,
  onSettle,
  row
}: {
  isLast: boolean;
  onSettle: () => void;
  row: BalanceDisplayRow;
}) {
  const { t } = useTranslation();
  const locale = usePreferencesStore((state) => state.locale);
  const { colors } = useTheme();
  const isCredit = row.netPaisa > 0;
  const isDebt = row.netPaisa < 0;
  const rowColor = isCredit ? colors.positive : colors.negative;
  const rowTint = isCredit ? colors.tintPositive : colors.tintNegative;
  const amountLabel = formatMoney(Math.abs(row.netPaisa), locale);
  const relationLabel = t(isCredit ? "balance.you_are_owed_name" : "balance.you_owe_name", {
    name: row.counterpartyName
  });

  return (
    <Pressable
      accessibilityLabel={`${relationLabel}. ${amountLabel}`}
      accessibilityRole={isDebt ? "button" : undefined}
      disabled={!isDebt}
      onPress={isDebt ? onSettle : undefined}
      style={({ pressed }) => ({
        alignItems: "center",
        borderBottomColor: colors.rowDivider,
        borderBottomWidth: isLast ? 0 : 1,
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 64,
        opacity: pressed ? 0.78 : 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm
      })}
    >
      <Avatar name={row.counterpartyName} size="sm" />
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{ color: colors.inkPrimary }}
          variant="bodyStrong"
        >
          {relationLabel}
        </Text>
        <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="caption">
          {t("groups.detail.people.pending")}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", flexShrink: 0, gap: spacing.xs, maxWidth: 128 }}>
        <View
          style={{
            backgroundColor: rowTint,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2
          }}
        >
          <Text
            accessibilityLabel={amountLabel}
            adjustsFontSizeToFit
            minimumFontScale={0.76}
            numberOfLines={1}
            style={{ color: rowColor, fontVariant: ["tabular-nums"] }}
            variant="label"
          >
            {amountLabel}
          </Text>
        </View>
        {isDebt ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
            <Text style={{ color: colors.brandPrimary }} variant="label">
              {t("groups.detail.people.settle_cta")}
            </Text>
            <ArrowRight color={colors.brandPrimary} size={14} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
