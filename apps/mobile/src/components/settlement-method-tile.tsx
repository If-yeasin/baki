import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react-native";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { Text, radii, spacing, useTheme } from "@baki/ui";

type SettlementMethodTileVariant = "primary" | "manual";

export type SettlementMethodTileProps = {
  amountLabel?: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  showDisclosure?: boolean;
  style?: StyleProp<ViewStyle>;
  subtitle: string;
  testID?: string;
  variant?: SettlementMethodTileVariant;
};

export function SettlementMethodTile({
  amountLabel,
  disabled = false,
  icon,
  label,
  onPress,
  showDisclosure = false,
  style,
  subtitle,
  testID,
  variant = "manual"
}: SettlementMethodTileProps) {
  const { colors } = useTheme();
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityLabel={amountLabel ? `${label}, ${amountLabel}` : label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: isPrimary ? colors.tintBrand : colors.bgSurface,
          borderColor: isPrimary ? colors.borderStrong : colors.borderSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          flex: 1,
          gap: spacing.xs,
          minHeight: isPrimary ? 108 : 96,
          minWidth: 0,
          opacity: disabled ? 0.48 : pressed ? 0.78 : 1,
          padding: spacing.md
        },
        style
      ]}
      testID={testID}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: isPrimary ? colors.brandPrimary : colors.bgSubtle,
            borderRadius: radii.pill,
            height: 34,
            justifyContent: "center",
            width: 34
          }}
        >
          {icon}
        </View>
        {showDisclosure ? (
          <ChevronRight color={colors.inkMuted} size={18} style={{ marginLeft: "auto" }} />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text ellipsizeMode="tail" numberOfLines={2} variant="bodyStrong">
          {label}
        </Text>
        <Text ellipsizeMode="tail" numberOfLines={2} tone="muted" variant="caption">
          {subtitle}
        </Text>
      </View>
      {amountLabel ? (
        <Text
          accessibilityLabel={amountLabel}
          ellipsizeMode="tail"
          numberOfLines={1}
          style={{ fontVariant: ["tabular-nums"], textAlign: "right" }}
          tone={isPrimary ? "brand" : "primary"}
          variant="bodyStrong"
        >
          {amountLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}
