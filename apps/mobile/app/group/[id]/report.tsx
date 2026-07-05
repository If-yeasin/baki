import { formatDhakaDate, formatMoney, toBengaliNumerals } from "@baki/i18n";
import { Stack, useLocalSearchParams } from "expo-router";
import { BarChart3, Crown, ReceiptText, ShieldCheck } from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text, radii, spacing, useTheme } from "@baki/ui";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { useGroupBalances } from "@/features/balances/use-balances";
import { useExpenses } from "@/features/expenses/use-expenses";
import { useGroupDetail } from "@/features/groups/use-group-detail";
import { usePreferencesStore } from "@/stores/preferences";
import {
  buildGroupMonthlyReport,
  getCurrentDhakaMonthPeriod,
  type GroupMonthlyReport
} from "@/features/reports/group-report";
import { useGroupReportSettlements } from "@/features/reports/use-group-report";

function formatCount(count: number, locale: string): string {
  return locale === "bn" ? toBengaliNumerals(count) : String(count);
}

type StatCardProps = {
  label: string;
  value: string;
};

function StatCard({ label, value }: StatCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderColor: colors.borderSubtle,
        borderRadius: radii.md,
        borderWidth: 1,
        flex: 1,
        gap: spacing.xs,
        minWidth: 140,
        padding: spacing.md
      }}
    >
      <Text style={{ color: colors.inkMuted }} variant="caption">
        {label}
      </Text>
      <Text style={{ color: colors.inkPrimary }} variant="h3">
        {value}
      </Text>
    </View>
  );
}

type ReportSectionProps = {
  children: ReactNode;
  title: string;
};

function ReportSection({ children, title }: ReportSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.inkSecondary }} variant="label">
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          gap: spacing.sm,
          padding: spacing.md
        }}
      >
        {children}
      </View>
    </View>
  );
}

type SimpleRowProps = {
  label: string;
  value: string;
};

function SimpleRow({ label, value }: SimpleRowProps) {
  const { colors } = useTheme();

  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
      <Text style={{ color: colors.inkPrimary, flex: 1 }} variant="body">
        {label}
      </Text>
      <Text style={{ color: colors.inkSecondary }} variant="bodyStrong">
        {value}
      </Text>
    </View>
  );
}

function useMonthlyReport(groupId: string | undefined): GroupMonthlyReport | null {
  const detailQuery = useGroupDetail(groupId);
  const expensesQuery = useExpenses(groupId);
  const balancesQuery = useGroupBalances(groupId);
  const settlementsQuery = useGroupReportSettlements(groupId);
  const period = useMemo(() => getCurrentDhakaMonthPeriod(), []);

  return useMemo(() => {
    const detail = detailQuery.data;
    if (
      !detail ||
      balancesQuery.data === undefined ||
      expensesQuery.data === undefined ||
      settlementsQuery.data === undefined
    ) {
      return null;
    }

    return buildGroupMonthlyReport({
      balances: (balancesQuery.data ?? []).map((balance) => ({
        netPaisa: balance.net_paisa,
        userId: balance.user_id
      })),
      expenses: (expensesQuery.data ?? []).map((expense) => ({
        amountPaisa: expense.amountPaisa,
        category: expense.category,
        deletedAt: null,
        id: expense.id,
        occurredAt: expense.occurredAt,
        paidBy: expense.paidBy
      })),
      groupName: detail.group.name,
      members: new Map(detail.members.map((member) => [member.userId, member.displayName])),
      period,
      settlements: settlementsQuery.data ?? []
    });
  }, [balancesQuery.data, detailQuery.data, expensesQuery.data, period, settlementsQuery.data]);
}

export default function GroupReportScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id;
  const locale = usePreferencesStore((state) => state.locale);
  const { colors } = useTheme();
  const report = useMonthlyReport(groupId);
  const trackedReportViewKeyRef = useRef<string | null>(null);
  const reportViewKey = report && groupId ? `${groupId}:${report.period.startAt}:${report.period.endAt}` : null;

  useEffect(() => {
    if (!reportViewKey || trackedReportViewKeyRef.current === reportViewKey) return;
    trackedReportViewKeyRef.current = reportViewKey;

    trackAnalyticsEvent("report.viewed", {
      featureId: "report.monthly_preview",
      locale,
      paywall: "free_beta",
      planKey: "khata_pro_group",
      reportType: "monthly_preview",
      surface: "group_report"
    });
  }, [locale, reportViewKey]);

  const periodLabel = report
    ? t("reports.monthly.period", {
        end: formatDhakaDate(new Date(new Date(report.period.endAt).getTime() - 1), locale),
        start: formatDhakaDate(report.period.startAt, locale)
      })
    : "";

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["4xl"] }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Stack.Screen options={{ title: t("reports.monthly.title") }} />

      <View style={{ gap: spacing.sm }}>
        <View
          style={{
            alignItems: "center",
            alignSelf: "flex-start",
            backgroundColor: colors.tintBrand,
            borderRadius: radii.pill,
            flexDirection: "row",
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs
          }}
        >
          <Crown color={colors.brandPrimary} size={14} />
          <Text style={{ color: colors.brandPrimary }} variant="label">
            {t("reports.monthly.badge")}
          </Text>
        </View>
        <Text style={{ color: colors.inkPrimary }} variant="h2">
          {t("reports.monthly.title")}
        </Text>
        <Text style={{ color: colors.inkSecondary }} variant="body">
          {report
            ? t("reports.monthly.subtitle", { groupName: report.groupName })
            : t("common.loading")}
        </Text>
        {periodLabel ? (
          <Text style={{ color: colors.inkMuted }} variant="caption">
            {periodLabel}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        <StatCard
          label={t("reports.monthly.totalSpent")}
          value={report ? formatMoney(report.totalExpensesPaisa, locale) : "—"}
        />
        <StatCard
          label={t("reports.monthly.expenses")}
          value={report ? formatCount(report.expenseCount, locale) : "—"}
        />
        <StatCard
          label={t("reports.monthly.settlements")}
          value={report ? formatCount(report.completedSettlementsCount, locale) : "—"}
        />
        <StatCard
          label={t("reports.monthly.pendingBalances")}
          value={report ? formatCount(report.pendingBalanceCount, locale) : "—"}
        />
      </View>

      <ReportSection title={t("reports.monthly.topPayer")}>
        {report ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
            <ReceiptText color={colors.brandPrimary} size={22} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.inkPrimary }} variant="bodyStrong">
                {report.highestPayer?.displayName ?? t("reports.monthly.noTopPayer")}
              </Text>
              {report.highestPayer ? (
                <Text style={{ color: colors.inkSecondary }} variant="caption">
                  {formatMoney(report.highestPayer.amountPaisa, locale)}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={{ color: colors.inkMuted }} variant="body">
            {t("common.loading")}
          </Text>
        )}
      </ReportSection>

      <ReportSection title={t("reports.monthly.categories")}>
        {!report ? (
          <Text style={{ color: colors.inkMuted }} variant="body">
            {t("common.loading")}
          </Text>
        ) : report.categoryBreakdown.length ? (
          report.categoryBreakdown.map((category) => (
            <SimpleRow
              key={category.category}
              label={t(`expense.category.${category.category}`)}
              value={formatMoney(category.amountPaisa, locale)}
            />
          ))
        ) : (
          <Text style={{ color: colors.inkMuted }} variant="body">
            {t("reports.monthly.empty")}
          </Text>
        )}
      </ReportSection>

      <ReportSection title={t("reports.monthly.memberBalances")}>
        {!report ? (
          <Text style={{ color: colors.inkMuted }} variant="body">
            {t("common.loading")}
          </Text>
        ) : report.memberNetBalances.length ? (
          report.memberNetBalances.map((member) => (
            <SimpleRow
              key={member.userId}
              label={member.displayName}
              value={formatMoney(member.netPaisa, locale)}
            />
          ))
        ) : (
          <Text style={{ color: colors.inkMuted }} variant="body">
            {t("balance.all_settled")}
          </Text>
        )}
      </ReportSection>

      <View
        style={{
          backgroundColor: colors.tintBrand,
          borderColor: colors.borderSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          gap: spacing.sm,
          padding: spacing.md
        }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
          <ShieldCheck color={colors.brandPrimary} size={18} />
          <Text style={{ color: colors.inkPrimary, flex: 1 }} variant="bodyStrong">
            {t("reports.monthly.khataPro.title")}
          </Text>
        </View>
        <Text style={{ color: colors.inkSecondary }} variant="body">
          {t("reports.monthly.khataPro.body")}
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
          <BarChart3 color={colors.brandPrimary} size={16} />
          <Text style={{ color: colors.inkMuted, flex: 1 }} variant="caption">
            {t("reports.monthly.trust")}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
