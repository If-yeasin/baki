import { useEffect, useRef } from "react";
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";

import { lightColors, radii } from "./theme/tokens";

type SkeletonVariant = "circle" | "rect" | "text";

export type SkeletonProps = {
  accessibilityLabel?: string;
  animated?: boolean;
  height?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  variant?: SkeletonVariant;
  width?: DimensionValue;
};

export function Skeleton({
  accessibilityLabel,
  animated = true,
  height,
  style,
  variant = "rect",
  width = "100%"
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(animated ? 0.56 : 1)).current;

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
          toValue: 0.56,
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
          backgroundColor: lightColors.bgSubtle,
          borderRadius,
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
