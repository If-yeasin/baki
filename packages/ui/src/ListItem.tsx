import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "./Text";
import { spacing } from "./theme/tokens";

export type ListItemProps = {
  leading?: ReactNode;
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
};

export function ListItem({ leading, subtitle, title, trailing }: ListItemProps) {
  return (
    <View
      accessibilityRole="summary"
      style={{ alignItems: "center", flexDirection: "row", gap: spacing.md, minHeight: 56 }}
    >
      {leading}
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text tone="secondary" variant="caption">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
