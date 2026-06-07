import { type SupportedLocale } from "@baki/i18n";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { Avatar } from "./Avatar";
import { Money } from "./Money";
import { Text } from "./Text";
import { radii, spacing } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

export type MemberPickerRowProps = {
  accessibilityLabel?: string;
  locale?: SupportedLocale;
  name: string;
  onToggle: () => void;
  selected: boolean;
  sharePaisa?: number;
  style?: StyleProp<ViewStyle>;
};

export function MemberPickerRow({
  accessibilityLabel,
  locale = "bn",
  name,
  onToggle,
  selected,
  sharePaisa,
  style
}: MemberPickerRowProps) {
  const { colors, scheme } = useTheme();
  const checkColor = scheme === "dark" ? colors.bgCanvas : colors.bgSurface;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? name}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onToggle}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor: selected ? colors.bgSubtle : colors.bgSurface,
          borderColor: selected ? colors.brandPrimary : colors.borderSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing.md,
          minHeight: 54,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        },
        style
      ]}
    >
      <Avatar name={name} size="md" />
      <View style={{ flex: 1, flexShrink: 1, gap: spacing.xs }}>
        <Text ellipsizeMode="tail" numberOfLines={1} variant="bodyStrong">
          {name}
        </Text>
        {sharePaisa === undefined ? null : (
          <Money
            amountPaisa={sharePaisa}
            locale={locale}
            style={{ fontSize: 13, lineHeight: 18 }}
            tone="secondary"
          />
        )}
      </View>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          alignItems: "center",
          backgroundColor: selected ? colors.brandPrimary : "transparent",
          borderColor: selected ? colors.brandPrimary : colors.borderStrong,
          borderRadius: radii.pill,
          borderWidth: 1.5,
          height: 24,
          justifyContent: "center",
          width: 24
        }}
      >
        {selected ? (
          <Text style={{ color: checkColor, fontSize: 14, lineHeight: 16 }} variant="label">
            ✓
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
