import { View, type ViewProps } from "react-native";

import { radii, spacing } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

/**
 * Card is the workhorse container for grouped sections (overall balance,
 * settings groups, settlement summaries). Surface background, hairline
 * border, large radius. No shadow — depth is communicated by the surface
 * step against the canvas, not by drop shadows.
 */
export function Card({ children, style, ...props }: ViewProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.lg,
          borderWidth: 1,
          padding: spacing.lg
        },
        style
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
