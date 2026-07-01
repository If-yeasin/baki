import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, BadgeCheck, Banknote, HandCoins, Smartphone } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { formatMoney } from "@baki/i18n";
import { Avatar, Skeleton, Text, Toast, radii, spacing, useTheme } from "@baki/ui";
import { PaymentInputError, isValidBdPhone } from "@baki/payments";

import { BakiEmptyState } from "@/components/baki-empty-state";
import { SettlementMethodTile } from "@/components/settlement-method-tile";
import { useSession } from "@/features/auth/use-session";
import {
  buildRawBalanceFallbackPlan,
  buildUserSettlementPlan,
  useSimplifiedDebts,
  type UserSettlementTransfer
} from "@/features/balances/use-simplified-debts";
import { useGroupBalances } from "@/features/balances/use-balances";
import { useGroupDetail } from "@/features/groups/use-group-detail";
import { openSettlement } from "@/features/settlement/open-settlement";
import { useCreateSettlement } from "@/features/settlement/use-create-settlement";
import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import { usePreferencesStore } from "@/stores/preferences";

type Creditor = {
  amountPaisa: number;
  bkashNumber: string | null;
  direction: "pay" | "receive";
  displayName: string;
  fromUser: string;
  nagadNumber: string | null;
  phone: string;
  toUser: string;
  userId: string;
};

type SettlementProvider = "bkash" | "nagad" | "cash" | "other";

type SettlementNotice = {
  bodyKey?: string;
  titleKey: string;
  variant: "error" | "info" | "success" | "warning";
};

function SettlementFlowGuide() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const steps = [
    {
      icon: Smartphone,
      iconColor: colors.brandPrimary,
      titleKey: "settle.guide.open.title",
      bodyKey: "settle.guide.open.body"
    },
    {
      icon: BadgeCheck,
      iconColor: colors.positive,
      titleKey: "settle.guide.confirm.title",
      bodyKey: "settle.guide.confirm.body"
    },
    {
      icon: HandCoins,
      iconColor: colors.accentGold,
      titleKey: "settle.guide.record.title",
      bodyKey: "settle.guide.record.body"
    }
  ] as const;

  return (
    <View
      style={{
        backgroundColor: colors.bgSubtle,
        borderColor: colors.borderSubtle,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing.sm,
        padding: spacing.md
      }}
      testID="settle-flow-guide"
    >
      <Text style={{ color: colors.inkSecondary }} variant="label">
        {t("settle.guide.title")}
      </Text>
      <View style={{ gap: spacing.sm }}>
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <View
              key={step.titleKey}
              style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: colors.bgSurface,
                  borderRadius: radii.pill,
                  height: 32,
                  justifyContent: "center",
                  width: 32
                }}
              >
                <Icon color={step.iconColor} size={17} />
              </View>
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{ color: colors.inkPrimary }}
                  variant="caption"
                >
                  {t(step.titleKey)}
                </Text>
                <Text ellipsizeMode="tail" numberOfLines={2} tone="muted" variant="caption">
                  {t(step.bodyKey)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function SettleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = usePreferencesStore((state) => state.locale);
  const session = useSession();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? "";
  const { colors } = useTheme();
  const [pendingCreditor, setPendingCreditor] = useState<{
    creditor: Creditor;
    provider: SettlementProvider;
  } | null>(null);
  const [settlementNotice, setSettlementNotice] = useState<SettlementNotice | null>(null);

  const detailQuery = useGroupDetail(groupId);
  const balancesQuery = useGroupBalances(groupId);
  const simplifiedDebtsQuery = useSimplifiedDebts(groupId);
  const createSettlement = useCreateSettlement();

  const simplifiedTransfers = useMemo(() => {
    if (!session.userId) return [] as UserSettlementTransfer[];
    return buildUserSettlementPlan(simplifiedDebtsQuery.data ?? [], session.userId);
  }, [session.userId, simplifiedDebtsQuery.data]);

  const fallbackTransfers = useMemo(() => {
    if (!session.userId) return [] as UserSettlementTransfer[];
    return buildRawBalanceFallbackPlan(balancesQuery.data ?? [], session.userId);
  }, [balancesQuery.data, session.userId]);

  const usingRawBalanceFallback = simplifiedDebtsQuery.isError;
  const settlementTransfers = usingRawBalanceFallback ? fallbackTransfers : simplifiedTransfers;
  const profileIds = useMemo(
    () =>
      Array.from(new Set(settlementTransfers.map((transfer) => transfer.counterpartyId))).sort(),
    [settlementTransfers]
  );

  const profilesQuery = useQuery({
    enabled: profileIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone, bkash_number, nagad_number")
        .in("id", profileIds);

      if (error) throw error;

      return data ?? [];
    },
    queryKey: ["profiles", "byIds", profileIds]
  });

  const creditors: Creditor[] = useMemo(() => {
    const profileMap = new Map((profilesQuery.data ?? []).map((profile) => [profile.id, profile]));

    return settlementTransfers.map((transfer) => {
      const profile = profileMap.get(transfer.counterpartyId);

      return {
        amountPaisa: transfer.amountPaisa,
        bkashNumber: profile?.bkash_number ?? null,
        direction: transfer.direction,
        displayName: profile?.display_name ?? t("common.unknown_user"),
        fromUser: transfer.fromUser,
        nagadNumber: profile?.nagad_number ?? null,
        phone: profile?.phone ?? "",
        toUser: transfer.toUser,
        userId: transfer.counterpartyId
      };
    });
  }, [profilesQuery.data, settlementTransfers, t]);

  const totalOwedPaisa = useMemo(
    () => creditors.reduce((sum, creditor) => sum + creditor.amountPaisa, 0),
    [creditors]
  );

  async function handleOpenProvider(creditor: Creditor, provider: "bkash" | "nagad") {
    if (creditor.direction === "receive") {
      setSettlementNotice({
        bodyKey: "settle.notice.receiveMfs.body",
        titleKey: "settle.notice.receiveMfs.title",
        variant: "info"
      });
      return;
    }

    const number = provider === "bkash" ? creditor.bkashNumber : creditor.nagadNumber;
    const targetNumber = number ?? creditor.phone;

    if (!isValidBdPhone(targetNumber)) {
      setSettlementNotice({
        bodyKey: "settle.notice.noNumber.body",
        titleKey: "settle.notice.noNumber.title",
        variant: "error"
      });
      return;
    }

    try {
      const result = await openSettlement({
        amountPaisa: creditor.amountPaisa,
        provider,
        recipientNumber: targetNumber
      });

      if (result.kind !== "opened") {
        setSettlementNotice({
          bodyKey: "settle.notice.copied.body",
          titleKey: "settle.notice.copied.title",
          variant: "info"
        });
      } else {
        setSettlementNotice({
          bodyKey: "settle.notice.opened.body",
          titleKey: "settle.notice.opened.title",
          variant: "success"
        });
      }

      setPendingCreditor({ creditor, provider });
    } catch (error) {
      if (error instanceof PaymentInputError) {
        setSettlementNotice({
          bodyKey: "settle.notice.noNumber.body",
          titleKey: "settle.notice.noNumber.title",
          variant: "error"
        });
        return;
      }
      Sentry.captureException(error, { tags: { feature: "settle.openProvider", provider } });
      setSettlementNotice({ titleKey: "common.error.generic", variant: "error" });
    }
  }

  async function handleMarkPaid(creditor: Creditor, method: SettlementProvider) {
    if (!session.userId) return;

    try {
      const result = await createSettlement.mutateAsync({
        amountPaisa: creditor.amountPaisa,
        fromUser: creditor.fromUser,
        groupId,
        method,
        toUser: creditor.toUser
      });

      setPendingCreditor(null);
      if (result.status === "queued") {
        setSettlementNotice({
          bodyKey: "sync.offline.saved.body",
          titleKey: "sync.offline.saved.title",
          variant: "success"
        });
        return;
      }

      router.back();
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: "settle.markPaid" } });
      setSettlementNotice({ titleKey: "common.error.generic", variant: "error" });
    }
  }

  const profilesPending = profileIds.length > 0 && profilesQuery.isPending;

  if (
    balancesQuery.isPending ||
    detailQuery.isPending ||
    simplifiedDebtsQuery.isPending ||
    profilesPending
  ) {
    return (
      <ScrollView
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl }}
        style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
      >
        <Stack.Screen options={{ title: t("settle.title") }} />
        <Skeleton height={88} />
        <Skeleton height={88} />
      </ScrollView>
    );
  }

  const renderProviderTile = (
    creditor: Creditor,
    provider: SettlementProvider,
    idx: number,
    onPress: () => void,
    disabled = false
  ) => {
    const isMfs = provider === "bkash" || provider === "nagad";
    const labelKey = `settle.via.${provider}` as const;
    const subtitleKey = `settle.method.${provider}.short` as const;
    const Icon = isMfs ? Smartphone : provider === "cash" ? Banknote : HandCoins;
    const iconColor = isMfs
      ? colors.inkOnBrand
      : provider === "cash"
        ? colors.accentGold
        : colors.info;

    return (
      <SettlementMethodTile
        amountLabel={isMfs ? undefined : formatMoney(creditor.amountPaisa, locale)}
        disabled={disabled}
        icon={<Icon color={iconColor} size={19} />}
        label={t(labelKey)}
        onPress={onPress}
        showDisclosure={isMfs}
        subtitle={t(subtitleKey)}
        testID={`settle-${provider}-${idx}`}
        variant={isMfs ? "primary" : "manual"}
      />
    );
  };

  if (creditors.length === 0) {
    return (
      <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
        <Stack.Screen options={{ headerShown: false, title: t("settle.title") }} />
        <View
          style={{
            backgroundColor: colors.brandPrimary,
            gap: spacing.lg,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing["3xl"]
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
            <Pressable
              accessibilityLabel={t("common.cancel")}
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: radii.pill,
                height: 40,
                justifyContent: "center",
                opacity: pressed ? 0.72 : 1,
                width: 40
              })}
            >
              <ArrowLeft color={colors.inkOnBrand} size={20} />
            </Pressable>
            <Text style={{ color: colors.inkOnBrand, flex: 1, minWidth: 0 }} variant="h2">
              {t("settle.title")}
            </Text>
          </View>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: colors.inkOnBrand, opacity: 0.86 }}
            variant="label"
          >
            {detailQuery.data?.group.name ?? t("groups.detail.fallback_title")}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: spacing.xl,
            paddingBottom: spacing["5xl"]
          }}
          style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
        >
          <BakiEmptyState
            action={{
              accessibilityLabel: t("settle.empty.action"),
              label: t("settle.empty.action"),
              onPress: () => router.back(),
              variant: "secondary"
            }}
            body={t("settle.empty.body")}
            icon={BadgeCheck}
            testID="settle-empty-state"
            title={t("settle.empty.title")}
            tone="positive"
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, title: t("settle.title") }} />
      <View
        style={{
          backgroundColor: colors.brandPrimary,
          gap: spacing.lg,
          paddingBottom: spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing["3xl"]
        }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
          <Pressable
            accessibilityLabel={t("common.cancel")}
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.18)",
              borderRadius: radii.pill,
              height: 40,
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
              width: 40
            })}
          >
            <ArrowLeft color={colors.inkOnBrand} size={20} />
          </Pressable>
          <Text style={{ color: colors.inkOnBrand, flex: 1, minWidth: 0 }} variant="h2">
            {t("settle.title")}
          </Text>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: colors.inkOnBrand, opacity: 0.82 }}
            variant="label"
          >
            {detailQuery.data?.group.name ?? t("groups.detail.fallback_title")}
          </Text>
          <Text
            accessibilityLabel={formatMoney(totalOwedPaisa, locale)}
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: colors.inkOnBrand, fontVariant: ["tabular-nums"] }}
            variant="monoAmount"
          >
            {formatMoney(totalOwedPaisa, locale)}
          </Text>
          <Text style={{ color: colors.inkOnBrand, opacity: 0.86 }} variant="body">
            {t("settle.plan.body")}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          gap: spacing.lg,
          padding: spacing.xl,
          paddingBottom: spacing["4xl"]
        }}
      >
        {settlementNotice ? (
          <Toast
            dismissLabel={t("common.dismiss")}
            message={settlementNotice.bodyKey ? t(settlementNotice.bodyKey) : undefined}
            onDismiss={() => setSettlementNotice(null)}
            testID="settle-notice"
            title={t(settlementNotice.titleKey)}
            variant={settlementNotice.variant}
          />
        ) : null}
        <View
          style={{
            backgroundColor: usingRawBalanceFallback ? colors.tintWarning : colors.tintBrand,
            borderRadius: radii.md,
            gap: spacing.xs,
            padding: spacing.md
          }}
        >
          <Text
            style={{ color: usingRawBalanceFallback ? colors.warning : colors.brandPrimary }}
            variant="label"
          >
            {t(
              usingRawBalanceFallback ? "settle.plan.fallback.title" : "settle.plan.optimized.title"
            )}
          </Text>
          <Text style={{ color: colors.inkSecondary }} variant="caption">
            {t(
              usingRawBalanceFallback ? "settle.plan.fallback.body" : "settle.plan.optimized.body"
            )}
          </Text>
        </View>
        {creditors.map((creditor, idx) => (
          <View key={creditor.userId} testID={`settle-row-${idx}`}>
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderStrong,
                borderRadius: radii.lg,
                borderWidth: 1,
                gap: spacing.md,
                padding: spacing.lg
              }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
                <Avatar name={creditor.displayName} size="lg" />
                <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
                  <Text style={{ color: colors.inkMuted }} variant="label">
                    {t(creditor.direction === "pay" ? "settle.due_to" : "settle.receive_from")}
                  </Text>
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkPrimary }}
                    variant="bodyStrong"
                  >
                    {creditor.displayName}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: spacing.xs, maxWidth: 128 }}>
                  <Text style={{ color: colors.inkMuted }} variant="label">
                    {t(
                      creditor.direction === "pay"
                        ? "settle.amount_due"
                        : "settle.amount_receivable"
                    )}
                  </Text>
                  <Text
                    accessibilityLabel={formatMoney(creditor.amountPaisa, locale)}
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{
                      color: creditor.direction === "pay" ? colors.negative : colors.positive,
                      fontVariant: ["tabular-nums"],
                      textAlign: "right"
                    }}
                    variant="monoAmount"
                  >
                    {formatMoney(creditor.amountPaisa, locale)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: colors.tintWarning,
                  borderRadius: radii.md,
                  gap: 2,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm
                }}
              >
                <Text style={{ color: colors.warning }} variant="caption">
                  {t(creditor.direction === "pay" ? "settle.summary" : "settle.summary.receive", {
                    amount: formatMoney(creditor.amountPaisa, locale),
                    name: creditor.displayName
                  })}
                </Text>
              </View>

              <SettlementFlowGuide />

              {pendingCreditor?.creditor.userId === creditor.userId ? (
                <View
                  style={{
                    backgroundColor: colors.bgSubtle,
                    borderRadius: radii.lg,
                    gap: spacing.md,
                    padding: spacing.md
                  }}
                >
                  <View style={{ gap: spacing.xs }}>
                    <Text style={{ color: colors.inkPrimary }} variant="bodyStrong">
                      {t("settle.confirmation.title")}
                    </Text>
                    <Text style={{ color: colors.inkSecondary }} variant="caption">
                      {t("settle.confirmation.body")}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel={t("settle.action.markPaid")}
                    accessibilityRole="button"
                    disabled={createSettlement.isPending}
                    onPress={() =>
                      handleMarkPaid(pendingCreditor.creditor, pendingCreditor.provider)
                    }
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: colors.brandPrimary,
                      borderRadius: radii.pill,
                      justifyContent: "center",
                      minHeight: 48,
                      opacity: createSettlement.isPending ? 0.48 : pressed ? 0.82 : 1
                    })}
                    testID="settle-mark-paid-cta"
                  >
                    <Text style={{ color: colors.inkOnBrand }} variant="bodyStrong">
                      {createSettlement.isPending
                        ? t("common.loading")
                        : t("settle.action.markPaid")}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={{ gap: spacing.sm }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
                  <Text style={{ color: colors.inkMuted, flex: 1 }} variant="label">
                    {t("settle.methods.mfs_title")}
                  </Text>
                  <View
                    style={{
                      backgroundColor: colors.tintBrand,
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs
                    }}
                  >
                    <Text style={{ color: colors.brandPrimary }} variant="label">
                      {t("settle.methods.mfs_badge")}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {renderProviderTile(
                    creditor,
                    "bkash",
                    idx,
                    () => handleOpenProvider(creditor, "bkash"),
                    creditor.direction === "receive" || (!creditor.bkashNumber && !creditor.phone)
                  )}
                  {renderProviderTile(
                    creditor,
                    "nagad",
                    idx,
                    () => handleOpenProvider(creditor, "nagad"),
                    creditor.direction === "receive" || (!creditor.nagadNumber && !creditor.phone)
                  )}
                </View>
              </View>

              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.inkMuted }} variant="label">
                  {t("settle.methods.manual_title")}
                </Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {renderProviderTile(creditor, "cash", idx, () =>
                    handleMarkPaid(creditor, "cash")
                  )}
                  {renderProviderTile(creditor, "other", idx, () =>
                    handleMarkPaid(creditor, "other")
                  )}
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
