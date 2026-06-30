import { HandCoins, ListChecks, Plus, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text, radii, spacing, useTheme } from "@baki/ui";

type LedgerOverviewTone = "negative" | "positive" | "settled";
type LedgerOverviewActionKind = "add" | "balances" | "settle";

export type LedgerOverviewAction = {
  accessibilityLabel?: string;
  kind: LedgerOverviewActionKind;
  label: string;
  onPress: () => void;
  testID?: string;
};

export type LedgerOverviewMetric = {
  amountAccessibilityLabel: string;
  amountLabel: string;
  label: string;
  tone: "negative" | "positive";
};

type LedgerOverviewCardProps = {
  amountAccessibilityLabel: string;
  amountLabel: string;
  caption: string;
  metrics: [LedgerOverviewMetric, LedgerOverviewMetric];
  primaryAction: LedgerOverviewAction;
  secondaryAction?: LedgerOverviewAction;
  statusLabel: string;
  title: string;
  tone: LedgerOverviewTone;
};

const actionIcons: Record<LedgerOverviewActionKind, LucideIcon> = {
  add: Plus,
  balances: ListChecks,
  settle: HandCoins
};

export function LedgerOverviewCard({
  amountAccessibilityLabel,
  amountLabel,
  caption,
  metrics,
  primaryAction,
  secondaryAction,
  statusLabel,
  title,
  tone
}: LedgerOverviewCardProps) {
  const { colors } = useTheme();
  const toneColor =
    tone === "positive"
      ? colors.positive
      : tone === "negative"
        ? colors.negative
        : colors.inkPrimary;
  const tintColor =
    tone === "positive"
      ? colors.tintPositive
      : tone === "negative"
        ? colors.tintNegative
        : colors.bgSubtle;

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
      testID="ledger-overview-card"
    >
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
          <Text tone="muted" variant="label">
            {title}
          </Text>
          <Text
            accessibilityLabel={amountAccessibilityLabel}
            adjustsFontSizeToFit
            minimumFontScale={0.74}
            numberOfLines={1}
            style={{ color: toneColor, fontVariant: ["tabular-nums"] }}
            variant="monoAmount"
          >
            {amountLabel}
          </Text>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: toneColor }}
            variant="caption"
          >
            {statusLabel}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: tintColor,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs
          }}
        >
          <Text style={{ color: toneColor }} variant="label">
            {caption}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {metrics.map((metric) => (
          <MetricCell key={metric.label} metric={metric} />
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <OverviewActionButton action={primaryAction} variant="primary" />
        {secondaryAction ? (
          <OverviewActionButton action={secondaryAction} variant="secondary" />
        ) : null}
      </View>
    </View>
  );
}

function MetricCell({ metric }: { metric: LedgerOverviewMetric }) {
  const { colors } = useTheme();
  const metricColor = metric.tone === "positive" ? colors.positive : colors.negative;
  const metricTint = metric.tone === "positive" ? colors.tintPositive : colors.tintNegative;

  return (
    <View
      style={{
        backgroundColor: metricTint,
        borderRadius: radii.md,
        flex: 1,
        gap: spacing.xs,
        minWidth: 0,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm
      }}
    >
      <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="label">
        {metric.label}
      </Text>
      <Text
        accessibilityLabel={metric.amountAccessibilityLabel}
        adjustsFontSizeToFit
        minimumFontScale={0.76}
        numberOfLines={1}
        style={{ color: metricColor, fontVariant: ["tabular-nums"] }}
        variant="bodyStrong"
      >
        {metric.amountLabel}
      </Text>
    </View>
  );
}

function OverviewActionButton({
  action,
  variant
}: {
  action: LedgerOverviewAction;
  variant: "primary" | "secondary";
}) {
  const { colors } = useTheme();
  const Icon = actionIcons[action.kind];
  const isPrimary = variant === "primary";
  const foregroundColor = isPrimary ? colors.inkOnBrand : colors.inkPrimary;

  return (
    <Pressable
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      accessibilityRole="button"
      onPress={action.onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: isPrimary ? colors.brandPrimary : colors.bgSubtle,
        borderColor: isPrimary ? colors.brandPrimary : colors.borderSubtle,
        borderRadius: radii.pill,
        borderWidth: isPrimary ? 0 : 1,
        flex: 1,
        flexDirection: "row",
        gap: spacing.sm,
        justifyContent: "center",
        minHeight: 44,
        minWidth: 0,
        opacity: pressed ? 0.82 : 1,
        paddingHorizontal: spacing.sm
      })}
      testID={action.testID}
    >
      <Icon color={foregroundColor} size={16} />
      <Text
        ellipsizeMode="tail"
        numberOfLines={2}
        style={{ color: foregroundColor, flexShrink: 1, textAlign: "center" }}
        variant="label"
      >
        {action.label}
      </Text>
    </Pressable>
  );
}
