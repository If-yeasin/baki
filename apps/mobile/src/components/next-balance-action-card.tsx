import { ArrowRight, HandCoins } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text, radii, spacing, useTheme } from "@baki/ui";

import type { NextBalanceAction } from "@/features/balances/next-balance-action";

type NextBalanceActionCardProps = {
  action: NextBalanceAction;
  onPress: () => void;
  testID?: string;
};

export function NextBalanceActionCard({
  action,
  onPress,
  testID = "next-balance-action"
}: NextBalanceActionCardProps) {
  const { colors } = useTheme();
  const toneColor = action.tone === "negative" ? colors.negative : colors.positive;
  const tintColor = action.tone === "negative" ? colors.tintNegative : colors.tintPositive;

  return (
    <Pressable
      accessibilityLabel={`${action.title}. ${action.amountLabel}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: colors.bgSurface,
        borderColor: colors.borderSubtle,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 76,
        opacity: pressed ? 0.82 : 1,
        padding: spacing.md
      })}
      testID={testID}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: tintColor,
          borderRadius: radii.pill,
          height: 42,
          justifyContent: "center",
          width: 42
        }}
      >
        <HandCoins color={toneColor} size={20} />
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text tone="muted" variant="label">
          {action.actionLabel}
        </Text>
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{ color: colors.inkPrimary }}
          variant="bodyStrong"
        >
          {action.title}
        </Text>
        <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="caption">
          {action.subtitle}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", flexShrink: 0, gap: spacing.xs, maxWidth: 116 }}>
        <Text
          accessibilityLabel={action.amountLabel}
          adjustsFontSizeToFit
          minimumFontScale={0.76}
          numberOfLines={1}
          style={{ color: toneColor, fontVariant: ["tabular-nums"], textAlign: "right" }}
          variant="bodyStrong"
        >
          {action.amountLabel}
        </Text>
        <ArrowRight color={colors.inkMuted} size={18} />
      </View>
    </Pressable>
  );
}
