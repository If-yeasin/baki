import { formatMoney, type SupportedLocale } from "@baki/i18n";

import { Text, type TextProps } from "./Text";

type MoneyVariant = "positive" | "negative" | "neutral";

export type MoneyProps = Omit<TextProps, "children" | "variant"> & {
  amountPaisa: bigint | number;
  locale?: SupportedLocale;
  variant?: MoneyVariant;
};

/**
 * Locale-aware money display. Always:
 *   - reads paisa input (integer), renders via @baki/i18n's formatter
 *   - applies the monoAmount variant so amounts line up vertically
 *   - forces tabular numerals so digits don't jitter between rows
 *   - tints by variant: positive (owed to you), negative (you owe), neutral
 */
export function Money({
  amountPaisa,
  locale = "bn",
  style,
  variant = "neutral",
  ...props
}: MoneyProps) {
  const tone =
    variant === "positive" ? "positive" : variant === "negative" ? "negative" : "primary";
  const formatted = formatMoney(amountPaisa, locale);

  return (
    <Text
      accessibilityLabel={formatted}
      style={[{ fontVariant: ["tabular-nums"] }, style]}
      tone={tone}
      variant="monoAmount"
      {...props}
    >
      {formatted}
    </Text>
  );
}
