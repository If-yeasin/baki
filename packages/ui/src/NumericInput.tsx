import { toLatinNumerals } from "@baki/i18n";
import type { ReactNode } from "react";

import { Input, type InputProps } from "./Input";
import { Text } from "./Text";

export type NumericInputOptions = {
  allowDecimal?: boolean;
  maxDecimalPlaces?: number;
};

export type NumericInputProps = Omit<
  InputProps,
  "leading" | "onChangeText" | "trailing" | "value"
> &
  NumericInputOptions & {
    leading?: ReactNode;
    onChangeText?: (value: string) => void;
    onNumericValueChange?: (value: number | null) => void;
    prefix?: string;
    suffix?: string;
    trailing?: ReactNode;
    value?: string;
  };

export function sanitizeNumericInput(
  input: string,
  { allowDecimal = true, maxDecimalPlaces = 2 }: NumericInputOptions = {}
): string {
  const normalized = toLatinNumerals(input).replace(/,/g, ".");
  let nextValue = "";
  let hasDecimal = false;

  for (const char of normalized) {
    if (/\d/.test(char)) {
      nextValue += char;
      continue;
    }

    if (allowDecimal && char === "." && !hasDecimal) {
      nextValue += char;
      hasDecimal = true;
    }
  }

  if (allowDecimal && maxDecimalPlaces >= 0 && nextValue.includes(".")) {
    const [whole = "", fraction = ""] = nextValue.split(".");
    return `${whole}.${fraction.slice(0, maxDecimalPlaces)}`;
  }

  return nextValue;
}

function parseNumericValue(value: string): number | null {
  if (value.length === 0 || value === ".") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function NumericInput({
  allowDecimal = true,
  keyboardType,
  leading,
  maxDecimalPlaces = 2,
  onChangeText,
  onNumericValueChange,
  prefix,
  suffix,
  trailing,
  value,
  ...props
}: NumericInputProps) {
  const options = { allowDecimal, maxDecimalPlaces };
  const displayValue = value === undefined ? undefined : sanitizeNumericInput(value, options);
  const resolvedLeading = prefix ? (
    <Text tone="muted" variant="bodyStrong">
      {prefix}
    </Text>
  ) : (
    leading
  );
  const resolvedTrailing = suffix ? (
    <Text tone="muted" variant="bodyStrong">
      {suffix}
    </Text>
  ) : (
    trailing
  );

  function handleChangeText(nextText: string) {
    const sanitized = sanitizeNumericInput(nextText, options);
    onChangeText?.(sanitized);
    onNumericValueChange?.(parseNumericValue(sanitized));
  }

  return (
    <Input
      keyboardType={keyboardType ?? (allowDecimal ? "decimal-pad" : "number-pad")}
      leading={resolvedLeading}
      onChangeText={handleChangeText}
      trailing={resolvedTrailing}
      value={displayValue}
      {...props}
    />
  );
}
