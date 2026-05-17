import { View, type ViewProps } from "react-native";

import { lightColors, radii, spacing } from "./theme/tokens";

export function Card({ children, style, ...props }: ViewProps) {
  return (
    <View
      style={[
        {
          backgroundColor: lightColors.bgSurface,
          borderColor: lightColors.borderSubtle,
          borderRadius: radii.md,
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
