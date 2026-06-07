import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Banknote, HandCoins, Smartphone } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { formatMoney } from "@baki/i18n";
import { Avatar, EmptyState, Skeleton, Text, radii, spacing, useTheme } from "@baki/ui";
import { PaymentInputError, isValidBdPhone } from "@baki/payments";

import { useSession } from "@/features/auth/use-session";
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
  displayName: string;
  nagadNumber: string | null;
  phone: string;
  userId: string;
};

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
    provider: "bkash" | "nagad" | "cash" | "other";
  } | null>(null);

  const detailQuery = useGroupDetail(groupId);
  const balancesQuery = useGroupBalances(groupId);
  const createSettlement = useCreateSettlement();

  const creditorIds = useMemo(() => {
    if (!session.userId) return [] as string[];
    const selfRow = balancesQuery.data?.find((row) => row.user_id === session.userId);
    if (!selfRow || selfRow.net_paisa >= 0) return [] as string[];
    return (balancesQuery.data ?? [])
      .filter((row) => row.user_id !== session.userId && row.net_paisa > 0)
      .map((row) => row.user_id);
  }, [balancesQuery.data, session.userId]);

  const profilesQuery = useQuery({
    enabled: creditorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone, bkash_number, nagad_number")
        .in("id", creditorIds);

      if (error) throw error;

      return data ?? [];
    },
    queryKey: ["profiles", "byIds", creditorIds]
  });

  const creditors: Creditor[] = useMemo(() => {
    if (!session.userId) return [];
    const balances = balancesQuery.data ?? [];
    const selfRow = balances.find((row) => row.user_id === session.userId);
    if (!selfRow || selfRow.net_paisa >= 0) return [];

    const totalCredit = balances
      .filter((row) => row.user_id !== session.userId && row.net_paisa > 0)
      .reduce((sum, row) => sum + row.net_paisa, 0);

    if (totalCredit <= 0) return [];

    const selfDebt = -selfRow.net_paisa;

    // Allocate the caller's debt proportionally to each creditor's credit.
    // Floor each share, then assign the rounding remainder to the largest
    // creditor so the per-row sum equals selfDebt exactly (no drift paisa).
    const draft = (profilesQuery.data ?? []).map((profile) => {
      const balanceRow = balances.find((row) => row.user_id === profile.id);
      const credit = balanceRow?.net_paisa ?? 0;

      return {
        amountPaisa: Math.floor((credit / totalCredit) * selfDebt),
        bkashNumber: profile.bkash_number,
        credit,
        displayName: profile.display_name,
        nagadNumber: profile.nagad_number,
        phone: profile.phone,
        userId: profile.id
      };
    });

    const allocated = draft.reduce((sum, row) => sum + row.amountPaisa, 0);
    const remainder = selfDebt - allocated;
    if (remainder > 0 && draft.length > 0) {
      let largestIdx = 0;
      for (let i = 1; i < draft.length; i++) {
        if ((draft[i]?.credit ?? 0) > (draft[largestIdx]?.credit ?? 0)) largestIdx = i;
      }
      const target = draft[largestIdx];
      if (target) target.amountPaisa += remainder;
    }

    return draft.map(({ credit: _credit, ...row }) => row);
  }, [balancesQuery.data, profilesQuery.data, session.userId]);

  async function handleOpenProvider(creditor: Creditor, provider: "bkash" | "nagad") {
    const number = provider === "bkash" ? creditor.bkashNumber : creditor.nagadNumber;
    const targetNumber = number ?? creditor.phone;

    if (!isValidBdPhone(targetNumber)) {
      Alert.alert(t("settle.error.no_app"));
      return;
    }

    try {
      const result = await openSettlement({
        amountPaisa: creditor.amountPaisa,
        provider,
        recipientNumber: targetNumber
      });

      if (result.kind !== "opened") {
        Alert.alert(t("settle.error.no_app"), t("settle.error.copied"));
        return;
      }

      setPendingCreditor({ creditor, provider });
    } catch (error) {
      if (error instanceof PaymentInputError) {
        Alert.alert(t("settle.error.no_app"));
        return;
      }
      throw error;
    }
  }

  async function handleMarkPaid(creditor: Creditor, method: "bkash" | "nagad" | "cash" | "other") {
    if (!session.userId) return;

    try {
      await createSettlement.mutateAsync({
        amountPaisa: creditor.amountPaisa,
        fromUser: session.userId,
        groupId,
        method,
        toUser: creditor.userId
      });

      setPendingCreditor(null);
      router.back();
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: "settle.markPaid" } });
      Alert.alert(t("common.error.generic"));
    }
  }

  if (balancesQuery.isPending || detailQuery.isPending) {
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

  const renderProviderRow = (
    creditor: Creditor,
    provider: "bkash" | "nagad" | "cash" | "other",
    idx: number,
    onPress: () => void,
    disabled = false
  ) => {
    const isMfs = provider === "bkash" || provider === "nagad";
    const labelKey = `settle.via.${provider}` as const;
    const Icon = isMfs ? Smartphone : provider === "cash" ? Banknote : HandCoins;

    return (
      <Pressable
        accessibilityLabel={`${t(labelKey)} — ${creditor.displayName}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.bgCanvas,
          borderColor: colors.borderSubtle,
          borderRadius: radii.lg,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing.md,
          minHeight: 64,
          opacity: disabled ? 0.48 : pressed ? 0.78 : 1,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm
        })}
        testID={`settle-${provider}-${idx}`}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: isMfs ? colors.brandPrimary : colors.bgSubtle,
            borderRadius: radii.pill,
            height: 40,
            justifyContent: "center",
            width: 40
          }}
        >
          <Icon color={isMfs ? colors.bgCanvas : colors.inkSecondary} size={20} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ color: colors.inkPrimary }} variant="bodyStrong">
            {t(labelKey)}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.inkMuted }} variant="caption">
            {creditor.displayName}
          </Text>
        </View>
        <Text
          accessibilityLabel={formatMoney(creditor.amountPaisa, locale)}
          style={{ color: colors.inkPrimary, fontVariant: ["tabular-nums"] }}
          variant="bodyStrong"
        >
          {formatMoney(creditor.amountPaisa, locale)}
        </Text>
      </Pressable>
    );
  };

  if (creditors.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl }}
        style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
      >
        <Stack.Screen options={{ headerShown: false, title: t("settle.title") }} />
        <View
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderStrong,
            borderRadius: radii.xl,
            borderWidth: 1,
            marginTop: spacing["3xl"],
            padding: spacing.lg
          }}
        >
          <EmptyState body={t("balance.all_settled")} title={t("settle.title")} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, title: t("settle.title") }} />
      <View
        style={{
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderSubtle,
          borderBottomWidth: 1,
          gap: spacing.md,
          paddingBottom: spacing.lg,
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
              backgroundColor: colors.bgSubtle,
              borderRadius: radii.pill,
              height: 40,
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
              width: 40
            })}
          >
            <ArrowLeft color={colors.inkPrimary} size={20} />
          </Pressable>
          <Text style={{ color: colors.inkPrimary, flex: 1 }} variant="h2">
            {t("settle.title")}
          </Text>
        </View>
        <Text style={{ color: colors.inkSecondary }} variant="body">
          {t("settle.confirmation.body")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl, paddingBottom: spacing["4xl"] }}
      >
      {creditors.map((creditor, idx) => (
        <View key={creditor.userId} testID={`settle-row-${idx}`}>
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderStrong,
              borderRadius: radii.xl,
              borderWidth: 1,
              gap: spacing.md,
              padding: spacing.lg
            }}
          >
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
              <Avatar name={creditor.displayName} size="lg" />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={2}
                  style={{ color: colors.inkPrimary }}
                  variant="bodyStrong"
                >
                  {creditor.displayName}
                </Text>
                <Text style={{ color: colors.warning }} variant="caption">
                  {t("settle.summary", {
                    amount: formatMoney(creditor.amountPaisa, locale),
                    name: creditor.displayName
                  })}
                </Text>
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              {renderProviderRow(
                creditor,
                "bkash",
                idx,
                () => handleOpenProvider(creditor, "bkash"),
                !creditor.bkashNumber && !creditor.phone
              )}
              {renderProviderRow(
                creditor,
                "nagad",
                idx,
                () => handleOpenProvider(creditor, "nagad"),
                !creditor.nagadNumber && !creditor.phone
              )}
              {renderProviderRow(creditor, "cash", idx, () => handleMarkPaid(creditor, "cash"))}
              {renderProviderRow(creditor, "other", idx, () => handleMarkPaid(creditor, "other"))}
            </View>

            {pendingCreditor?.creditor.userId === creditor.userId ? (
              <Pressable
                accessibilityLabel={t("settle.action.markPaid")}
                accessibilityRole="button"
                disabled={createSettlement.isPending}
                onPress={() => handleMarkPaid(pendingCreditor.creditor, pendingCreditor.provider)}
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
                <Text style={{ color: colors.bgCanvas }} variant="bodyStrong">
                  {createSettlement.isPending ? t("common.loading") : t("settle.action.markPaid")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      </ScrollView>
    </View>
  );
}
