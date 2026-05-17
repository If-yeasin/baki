import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { lightColors, radii, spacing } from "./theme/tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = PressableProps & {
  children: string;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

const sizeStyle: Record<ButtonSize, ViewStyle> = {
  sm: { minHeight: 44, paddingHorizontal: spacing.lg },
  md: { minHeight: 48, paddingHorizontal: spacing.xl },
  lg: { minHeight: 54, paddingHorizontal: spacing["2xl"] }
};

const variantStyle: Record<ButtonVariant, ViewStyle> = {
  destructive: { backgroundColor: lightColors.negative },
  ghost: { backgroundColor: "transparent" },
  primary: { backgroundColor: lightColors.brandPrimary },
  secondary: { backgroundColor: lightColors.bgSubtle }
};

export function Button({
  accessibilityLabel,
  children,
  disabled,
  size = "md",
  style,
  variant = "primary",
  ...props
}: ButtonProps) {
  const textTone = variant === "secondary" || variant === "ghost" ? "primary" : undefined;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        {
          alignItems: "center",
          borderRadius: radii.md,
          justifyContent: "center",
          opacity: disabled ? 0.48 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }]
        },
        sizeStyle[size],
        variantStyle[variant],
        style
      ]}
      {...props}
    >
      <Text tone={textTone} variant="bodyStrong">
        {children}
      </Text>
    </Pressable>
  );
}
