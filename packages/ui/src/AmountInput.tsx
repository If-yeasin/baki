import { formatMoney, type SupportedLocale, toLatinNumerals } from "@baki/i18n";
import { useMemo } from "react";

import { Input, type InputProps } from "./Input";
import { Text } from "./Text";

const MAX_PAISA = 9_999_999_999;

export type AmountInputProps = Omit<
  InputProps,
  "keyboardType" | "onChangeText" | "value" | "leading" | "trailing"
> & {
  error?: string;
  helper?: string;
  label?: string;
  locale?: SupportedLocale;
  onChangePaisa: (paisa: number) => void;
  valuePaisa: number;
};

/**
 * The user types whole taka in the field. We store paisa internally:
 *   "125"  → 12500 paisa (= 125 BDT)
 *   "0"    → 0 paisa
 *   ""     → 0 paisa
 * Bengali digits accepted; everything that isn't a digit is dropped.
 */
export function sanitizePaisaInput(raw: string): number {
  const latin = toLatinNumerals(raw);
  const digitsOnly = latin.replace(/\D/g, "");

  if (digitsOnly.length === 0) {
    return 0;
  }

  const trimmed = digitsOnly.replace(/^0+(?=\d)/, "");
  const taka = Number(trimmed);

  if (!Number.isFinite(taka)) {
    return 0;
  }

  const paisa = taka * 100;
  return Math.min(paisa, MAX_PAISA);
}

export function AmountInput({
  accessibilityLabel,
  error,
  helper,
  helperText,
  label,
  locale = "bn",
  onChangePaisa,
  valuePaisa,
  ...props
}: AmountInputProps) {
  const display = useMemo(
    () => formatMoney(valuePaisa, locale).replace(/^৳\s*/, ""),
    [valuePaisa, locale]
  );

  function handleChangeText(next: string) {
    onChangePaisa(sanitizePaisaInput(next));
  }

  return (
    <Input
      accessibilityLabel={accessibilityLabel ?? label}
      errorText={error}
      helperText={helper ?? helperText}
      keyboardType="number-pad"
      label={label}
      leading={
        <Text tone="muted" variant="bodyStrong">
          ৳
        </Text>
      }
      onChangeText={handleChangeText}
      value={display}
      {...props}
    />
  );
}
