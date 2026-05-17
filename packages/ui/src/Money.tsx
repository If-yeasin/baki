import { formatMoney, type SupportedLocale } from "@baki/i18n";

import { Text, type TextProps } from "./Text";

type MoneyVariant = "positive" | "negative" | "neutral";

export type MoneyProps = Omit<TextProps, "children" | "variant"> & {
  amountPaisa: bigint | number;
  locale?: SupportedLocale;
  variant?: MoneyVariant;
};

export function Money({ amountPaisa, locale = "bn", variant = "neutral", ...props }: MoneyProps) {
  const tone = variant === "positive" ? "positive" : variant === "negative" ? "negative" : "primary";

  return (
    <Text
      accessibilityLabel={formatMoney(amountPaisa, locale)}
      tone={tone}
      variant="monoAmount"
      {...props}
    >
      {formatMoney(amountPaisa, locale)}
    </Text>
  );
}
