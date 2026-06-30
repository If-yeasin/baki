import { View } from "react-native";

import { Text, radii, spacing, useTheme } from "@baki/ui";

type ExpenseReviewCardProps = {
  amountLabel: string;
  categoryLabel: string;
  categoryValue: string;
  methodLabel: string;
  methodValue: string;
  payerLabel: string;
  payerValue: string;
  splitWithLabel: string;
  splitWithValue: string;
  statusLabel: string;
  title: string;
  totalLabel: string;
};

export function ExpenseReviewCard({
  amountLabel,
  categoryLabel,
  categoryValue,
  methodLabel,
  methodValue,
  payerLabel,
  payerValue,
  splitWithLabel,
  splitWithValue,
  statusLabel,
  title,
  totalLabel
}: ExpenseReviewCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderColor: colors.borderSubtle,
        borderRadius: radii.lg,
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.lg
      }}
      testID="expense-review-card"
    >
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
          <Text tone="muted" variant="label">
            {title}
          </Text>
          <Text ellipsizeMode="tail" numberOfLines={1} variant="bodyStrong">
            {statusLabel}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: spacing.xs, maxWidth: 150 }}>
          <Text tone="muted" variant="label">
            {totalLabel}
          </Text>
          <Text
            accessibilityLabel={amountLabel}
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ fontVariant: ["tabular-nums"], textAlign: "right" }}
            tone="brand"
            variant="monoAmount"
          >
            {amountLabel}
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <ReviewCell label={payerLabel} value={payerValue} />
          <ReviewCell label={splitWithLabel} value={splitWithValue} />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <ReviewCell label={methodLabel} value={methodValue} />
          <ReviewCell label={categoryLabel} value={categoryValue} />
        </View>
      </View>
    </View>
  );
}

function ReviewCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.bgSubtle,
        borderRadius: radii.md,
        flex: 1,
        gap: 2,
        minHeight: 58,
        minWidth: 0,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm
      }}
    >
      <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="label">
        {label}
      </Text>
      <Text ellipsizeMode="tail" numberOfLines={2} variant="bodyStrong">
        {value}
      </Text>
    </View>
  );
}
