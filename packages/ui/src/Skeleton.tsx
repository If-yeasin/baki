import { useEffect, useRef } from "react";
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";

import { radii } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

type SkeletonVariant = "circle" | "rect" | "text";

export type SkeletonProps = {
  accessibilityLabel?: string;
  animated?: boolean;
  height?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  variant?: SkeletonVariant;
  width?: DimensionValue;
};

/**
 * Loading shimmer. Sits on `bgSubtle` and cross-fades up to `borderSubtle`
 * via opacity so the dark canvas reads it as a soft pulse instead of a
 * harsh white flash. Never animates to a light colour, even in dark mode.
 */
export function Skeleton({
  accessibilityLabel,
  animated = true,
  height,
  style,
  variant = "rect",
  width = "100%"
}: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(animated ? 0.6 : 1)).current;

  useEffect(() => {
    if (!animated) {
      opacity.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: 720,
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          duration: 720,
          toValue: 0.6,
          useNativeDriver: true
        })
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [animated, opacity]);

  const resolvedHeight = height ?? (variant === "text" ? 18 : 48);
  const borderRadius = variant === "circle" ? radii.pill : variant === "text" ? radii.sm : radii.md;

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "progressbar" : undefined}
      importantForAccessibility={accessibilityLabel ? "auto" : "no"}
      style={[
        {
          backgroundColor: colors.bgSubtle,
          borderColor: colors.borderSubtle,
          borderRadius,
          borderWidth: 1,
          height: resolvedHeight,
          opacity,
          overflow: "hidden",
          width
        },
        variant === "circle" ? { aspectRatio: 1 } : null,
        style
      ]}
    />
  );
}
