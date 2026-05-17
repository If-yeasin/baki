import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { Badge } from "./Badge";
import { Text } from "./Text";
import { lightColors, radii, spacing } from "./theme/tokens";

type TabsSize = "sm" | "md";

export type TabItem<TValue extends string = string> = {
  accessibilityLabel?: string;
  badge?: number | string;
  disabled?: boolean;
  label: string;
  value: TValue;
};

export type TabsProps<TValue extends string = string> = {
  accessibilityLabel?: string;
  items: readonly TabItem<TValue>[];
  onValueChange: (value: TValue) => void;
  size?: TabsSize;
  style?: StyleProp<ViewStyle>;
  tabStyle?: StyleProp<ViewStyle>;
  value: TValue;
};

const tabSize: Record<TabsSize, ViewStyle> = {
  md: { minHeight: 44, paddingHorizontal: spacing.md },
  sm: { minHeight: 38, paddingHorizontal: spacing.sm }
};

export function Tabs<TValue extends string = string>({
  accessibilityLabel,
  items,
  onValueChange,
  size = "md",
  style,
  tabStyle,
  value
}: TabsProps<TValue>) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={[
        {
          backgroundColor: lightColors.bgSubtle,
          borderRadius: radii.md,
          flexDirection: "row",
          gap: spacing.xs,
          padding: spacing.xs
        },
        style
      ]}
    >
      {items.map((item) => {
        const selected = item.value === value;

        return (
          <Pressable
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityRole="tab"
            accessibilityState={{ disabled: item.disabled, selected }}
            disabled={item.disabled}
            key={item.value}
            onPress={() => onValueChange(item.value)}
            style={({ pressed }) => [
              {
                alignItems: "center",
                backgroundColor: selected ? lightColors.bgSurface : "transparent",
                borderColor: selected ? lightColors.borderSubtle : "transparent",
                borderRadius: radii.sm,
                borderWidth: 1,
                flex: 1,
                flexDirection: "row",
                gap: spacing.sm,
                justifyContent: "center",
                opacity: item.disabled ? 0.48 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }]
              },
              tabSize[size],
              tabStyle
            ]}
          >
            <Text tone={selected ? "primary" : "secondary"} variant="label">
              {item.label}
            </Text>
            {item.badge === undefined ? null : (
              <Badge size="sm" variant={selected ? "brand" : "neutral"}>
                {item.badge}
              </Badge>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
