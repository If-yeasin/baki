import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { lightColors, radii, spacing } from "./theme/tokens";

type BadgeSize = "sm" | "md";
type BadgeVariant = "brand" | "gold" | "info" | "negative" | "neutral" | "positive" | "warning";

export type BadgeProps = {
  accessibilityLabel?: string;
  children: number | string;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: BadgeVariant;
};

const badgePalette: Record<BadgeVariant, { backgroundColor: string; color: string }> = {
  brand: { backgroundColor: lightColors.brandPrimary, color: lightColors.bgSurface },
  gold: { backgroundColor: "#fff7dc", color: lightColors.accentGold },
  info: { backgroundColor: "#e0f2fe", color: lightColors.info },
  negative: { backgroundColor: "#fee2e2", color: lightColors.negative },
  neutral: { backgroundColor: lightColors.bgSubtle, color: lightColors.inkSecondary },
  positive: { backgroundColor: "#dcfce7", color: lightColors.positive },
  warning: { backgroundColor: "#ffedd5", color: lightColors.warning }
};

const badgeSize: Record<BadgeSize, ViewStyle> = {
  md: { minHeight: 28, paddingHorizontal: spacing.md },
  sm: { minHeight: 22, paddingHorizontal: spacing.sm }
};

export function Badge({
  accessibilityLabel,
  children,
  size = "md",
  style,
  textStyle,
  variant = "neutral"
}: BadgeProps) {
  const palette = badgePalette[variant];

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? String(children)}
      accessibilityRole="text"
      style={[
        {
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: palette.backgroundColor,
          borderRadius: radii.pill,
          justifyContent: "center"
        },
        badgeSize[size],
        style
      ]}
    >
      <Text
        style={[{ color: palette.color, fontVariant: ["tabular-nums"] }, textStyle]}
        variant="label"
      >
        {children}
      </Text>
    </View>
  );
}
