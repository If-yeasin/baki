import { HandCoins, Plus, Users } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text, radii, spacing, useTheme } from "@baki/ui";

type GroupBalanceTone = "negative" | "positive" | "settled";
type GroupActionKind = "add" | "balances" | "settle";

export type GroupBalanceAction = {
  accessibilityLabel?: string;
  kind: GroupActionKind;
  label: string;
  onPress: () => void;
  testID?: string;
};

type GroupBalanceActionCardProps = {
  amountAccessibilityLabel: string;
  amountLabel: string;
  overallLabel: string;
  primaryAction: GroupBalanceAction;
  secondaryAction: GroupBalanceAction;
  statusAmountLabel?: string;
  statusLabel: string;
  statusTitle: string;
  tone: GroupBalanceTone;
};

const actionIcons: Record<GroupActionKind, typeof Plus> = {
  add: Plus,
  balances: Users,
  settle: HandCoins
};

export function GroupBalanceActionCard({
  amountAccessibilityLabel,
  amountLabel,
  overallLabel,
  primaryAction,
  secondaryAction,
  statusAmountLabel,
  statusLabel,
  statusTitle,
  tone
}: GroupBalanceActionCardProps) {
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
        borderRadius: radii.md,
        gap: spacing.md,
        padding: spacing.lg
      }}
      testID="group-balance-action-card"
    >
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
          <Text tone="muted" variant="label">
            {overallLabel}
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
            {statusTitle}
          </Text>
        </View>
      </View>

      <View
        style={{
          alignItems: "center",
          backgroundColor: tintColor,
          borderRadius: radii.md,
          flexDirection: "row",
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm
        }}
      >
        <Text
          ellipsizeMode="tail"
          numberOfLines={2}
          style={{ color: toneColor, flex: 1, minWidth: 0 }}
          variant="bodyStrong"
        >
          {statusLabel}
        </Text>
        {statusAmountLabel ? (
          <Text
            accessibilityLabel={statusAmountLabel}
            adjustsFontSizeToFit
            minimumFontScale={0.76}
            numberOfLines={1}
            style={{
              color: toneColor,
              fontVariant: ["tabular-nums"],
              maxWidth: 126,
              textAlign: "right"
            }}
            variant="bodyStrong"
          >
            {statusAmountLabel}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <ActionButton action={primaryAction} variant="primary" />
        <ActionButton action={secondaryAction} variant="secondary" />
      </View>
    </View>
  );
}

function ActionButton({
  action,
  variant
}: {
  action: GroupBalanceAction;
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
