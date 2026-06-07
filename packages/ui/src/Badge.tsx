import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { radii, spacing } from "./theme/tokens";
import { useTheme, type ThemeColors } from "./theme/useTheme";

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

type BadgePalette = { backgroundColor: string; color: string };

function paletteFor(colors: ThemeColors, variant: BadgeVariant): BadgePalette {
  switch (variant) {
    case "brand":
      return { backgroundColor: colors.brandPrimary, color: colors.inkOnBrand };
    case "gold":
      return { backgroundColor: colors.tintGold, color: colors.accentGold };
    case "info":
      return { backgroundColor: colors.tintInfo, color: colors.info };
    case "negative":
      return { backgroundColor: colors.tintNegative, color: colors.negative };
    case "positive":
      return { backgroundColor: colors.tintPositive, color: colors.positive };
    case "warning":
      return { backgroundColor: colors.tintWarning, color: colors.warning };
    case "neutral":
    default:
      return { backgroundColor: colors.bgSubtle, color: colors.inkSecondary };
  }
}

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
  const { colors } = useTheme();
  const palette = paletteFor(colors, variant);

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
