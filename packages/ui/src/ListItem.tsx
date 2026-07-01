import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { spacing } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

export type ListItemProps = {
  /**
   * When `true`, draws a hairline `rowDivider` on the bottom edge — used when
   * the row sits inside a list on the canvas without a wrapping surface. The
   * containing screen decides; the row itself stays flat by default so it can
   * compose inside a Card without doubling borders.
   */
  divider?: boolean;
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
};

export function ListItem({
  divider = false,
  leading,
  style,
  subtitle,
  title,
  trailing
}: ListItemProps) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityRole="summary"
      style={[
        {
          alignItems: "center",
          borderBottomColor: divider ? colors.rowDivider : "transparent",
          borderBottomWidth: divider ? 1 : 0,
          flexDirection: "row",
          gap: spacing.md,
          minHeight: 56,
          paddingVertical: spacing.md
        },
        style
      ]}
    >
      {leading ? (
        <View
          style={{
            alignItems: "center",
            flexShrink: 0,
            justifyContent: "center",
            minHeight: 40,
            minWidth: 40
          }}
        >
          {leading}
        </View>
      ) : null}
      <View style={{ flex: 1, flexShrink: 1, gap: spacing.xs }}>
        <Text ellipsizeMode="tail" numberOfLines={1} variant="bodyStrong">
          {title}
        </Text>
        {subtitle ? (
          <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="caption">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={{ alignItems: "flex-end", flexShrink: 0 }}>{trailing}</View> : null}
    </View>
  );
}
