import { type SupportedLocale } from "@baki/i18n";
import i18next from "i18next";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Money } from "./Money";
import { Text } from "./Text";
import { radii, spacing } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

type BalancePillSize = "sm" | "md";

export type BalancePillProps = {
  accessibilityLabel?: string;
  locale?: SupportedLocale;
  netPaisa: number;
  size?: BalancePillSize;
  style?: StyleProp<ViewStyle>;
};

const paddingBySize: Record<BalancePillSize, ViewStyle> = {
  md: { minHeight: 44, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  sm: { minHeight: 36, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }
};

export function BalancePill({
  accessibilityLabel,
  locale = "bn",
  netPaisa,
  size = "md",
  style
}: BalancePillProps) {
  const { colors } = useTheme();
  let labelKey: "balance.you_owe" | "balance.you_are_owed" | "balance.all_settled";
  let tone: "positive" | "negative" | "neutral";
  let backgroundColor: string;
  let borderColor: string;

  if (netPaisa === 0) {
    labelKey = "balance.all_settled";
    tone = "neutral";
    backgroundColor = colors.bgSubtle;
    borderColor = colors.borderSubtle;
  } else if (netPaisa > 0) {
    labelKey = "balance.you_are_owed";
    tone = "positive";
    backgroundColor = colors.bgSubtle;
    borderColor = colors.positive;
  } else {
    labelKey = "balance.you_owe";
    tone = "negative";
    backgroundColor = colors.bgSubtle;
    borderColor = colors.negative;
  }

  const labelText = i18next.t(labelKey);
  const showAmount = netPaisa !== 0;
  const amountPaisa = netPaisa < 0 ? -netPaisa : netPaisa;
  const moneyVariant = tone === "positive" ? "positive" : tone === "negative" ? "negative" : "neutral";

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? labelText}
      accessibilityRole="text"
      style={[
        {
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor,
          borderColor,
          borderWidth: 1,
          borderRadius: radii.pill,
          flexDirection: "row",
          flexShrink: 1,
          flexWrap: "wrap",
          gap: spacing.sm,
          justifyContent: "center"
        },
        paddingBySize[size],
        style
      ]}
    >
      <Text
        tone={tone === "neutral" ? "secondary" : tone}
        variant={size === "sm" ? "label" : "bodyStrong"}
      >
        {labelText}
      </Text>
      {showAmount ? (
        <Money
          amountPaisa={amountPaisa}
          locale={locale}
          style={{ fontSize: size === "sm" ? 15 : 18, lineHeight: size === "sm" ? 22 : 24 }}
          variant={moneyVariant}
        />
      ) : null}
    </View>
  );
}
