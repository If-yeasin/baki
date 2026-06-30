import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { radii, spacing } from "./theme/tokens";
import { useTheme, type ThemeColors } from "./theme/useTheme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = PressableProps & {
  children: string;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

const sizeStyle: Record<ButtonSize, ViewStyle> = {
  sm: { minHeight: 44, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  md: { minHeight: 48, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  lg: { minHeight: 54, paddingHorizontal: spacing["2xl"], paddingVertical: spacing.md }
};

type VariantStyle = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
};

function stylesForVariant(colors: ThemeColors, variant: ButtonVariant): VariantStyle {
  switch (variant) {
    case "destructive":
      return { backgroundColor: colors.negative, borderColor: colors.negative, borderWidth: 0 };
    case "ghost":
      return { backgroundColor: "transparent", borderColor: "transparent", borderWidth: 0 };
    case "secondary":
      // Outlined chip-style surface — works on canvas without competing with brand.
      return {
        backgroundColor: colors.bgSurface,
        borderColor: colors.borderStrong,
        borderWidth: 1
      };
    case "primary":
    default:
      return {
        backgroundColor: colors.brandPrimary,
        borderColor: colors.brandPrimary,
        borderWidth: 0
      };
  }
}

export function Button({
  accessibilityLabel,
  children,
  disabled,
  size = "md",
  style,
  variant = "primary",
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const variantStyle = stylesForVariant(colors, variant);
  // Filled brand/destructive surfaces get the on-brand text token. Secondary and
  // ghost ride the primary ink so they read on both dark canvas and surface.
  const usesOnBrandText = variant === "primary" || variant === "destructive";
  const textTone = usesOnBrandText ? "onBrand" : "primary";

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        {
          alignItems: "center",
          borderRadius: variant === "ghost" ? radii.md : radii.pill,
          flexShrink: 1,
          justifyContent: "center",
          opacity: disabled ? 0.48 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }]
        },
        sizeStyle[size],
        variantStyle,
        style
      ]}
      {...props}
    >
      <Text numberOfLines={2} style={{ textAlign: "center" }} tone={textTone} variant="bodyStrong">
        {children}
      </Text>
    </Pressable>
  );
}
