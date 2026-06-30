import type { LucideIcon } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Button, Text, radii, spacing, useTheme, type EmptyStateAction } from "@baki/ui";

type EmptyTone = "brand" | "gold" | "positive" | "neutral";

export type BakiEmptyStateProps = {
  action?: EmptyStateAction;
  body: string;
  icon: LucideIcon;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
  tone?: EmptyTone;
};

export function BakiEmptyState({
  action,
  body,
  icon: Icon,
  style,
  testID,
  title,
  tone = "brand"
}: BakiEmptyStateProps) {
  const { colors } = useTheme();
  const toneStyles: Record<EmptyTone, { backgroundColor: string; color: string }> = {
    brand: { backgroundColor: colors.tintBrand, color: colors.brandPrimary },
    gold: { backgroundColor: colors.tintGold, color: colors.accentGold },
    neutral: { backgroundColor: colors.bgSubtle, color: colors.inkSecondary },
    positive: { backgroundColor: colors.tintPositive, color: colors.positive }
  };
  const selectedTone = toneStyles[tone];

  return (
    <View
      accessibilityRole="summary"
      style={[
        {
          alignItems: "center",
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.xl,
          borderWidth: 1,
          gap: spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xl
        },
        style
      ]}
      testID={testID}
    >
      <View
        accessible={false}
        style={{
          alignItems: "center",
          backgroundColor: selectedTone.backgroundColor,
          borderRadius: radii.lg,
          height: 56,
          justifyContent: "center",
          width: 56
        }}
      >
        <Icon color={selectedTone.color} size={28} strokeWidth={2.2} />
      </View>
      <View style={{ alignItems: "center", gap: spacing.sm, maxWidth: 284 }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.inkPrimary, textAlign: "center" }}
          variant="h2"
        >
          {title}
        </Text>
        <Text style={{ color: colors.inkSecondary, textAlign: "center" }} variant="body">
          {body}
        </Text>
      </View>
      {action ? (
        <Button
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          onPress={action.onPress}
          style={{ alignSelf: "stretch" }}
          variant={action.variant ?? "primary"}
        >
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}
