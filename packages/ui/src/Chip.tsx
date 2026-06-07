import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { radii, spacing } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

type ChipVariant = "neutral" | "brand";

export type ChipProps = Omit<PressableProps, "children" | "style"> & {
  children: string;
  leading?: ReactNode;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
  variant?: ChipVariant;
};

export function Chip({
  accessibilityLabel,
  accessibilityRole,
  children,
  disabled,
  leading,
  onLongPress,
  onPress,
  selected,
  style,
  trailing,
  variant = "neutral",
  ...props
}: ChipProps) {
  const { colors } = useTheme();
  const interactive = Boolean(onPress || onLongPress);
  const active = selected || variant === "brand";
  const isDisabled = disabled === true;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole={accessibilityRole ?? (interactive ? "button" : "text")}
      accessibilityState={{ disabled: isDisabled, selected }}
      disabled={isDisabled}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          // Selected: solid brand fill with on-brand ink.
          // Unselected: surface chip with strong border — reads on canvas without
          // a competing tint that would muddy the rhythm in dense rows.
          backgroundColor: active ? colors.brandPrimary : colors.bgSurface,
          borderColor: active ? colors.brandPrimary : colors.borderStrong,
          borderRadius: radii.pill,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing.sm,
          justifyContent: "center",
          minHeight: 40,
          opacity: isDisabled ? 0.48 : 1,
          paddingHorizontal: spacing.lg,
          transform: [{ scale: pressed && interactive ? 0.97 : 1 }]
        },
        style
      ]}
      {...props}
    >
      {leading}
      <Text
        ellipsizeMode="tail"
        numberOfLines={2}
        style={{ flexShrink: 1, maxWidth: 220, textAlign: "center" }}
        tone={active ? "onBrand" : "primary"}
        variant="bodyStrong"
      >
        {children}
      </Text>
      {trailing}
    </Pressable>
  );
}
