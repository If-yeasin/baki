import { toLatinNumerals } from "@baki/i18n";
import { useState } from "react";
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle
} from "react-native";

import { Text } from "./Text";
import { lightColors, radii, spacing } from "./theme/tokens";
import { typography } from "./theme/typography";

export type BdPhoneValidationError = "invalid_length" | "invalid_prefix";

export type BdPhoneValidationResult = {
  e164: string | null;
  error?: BdPhoneValidationError;
  isValid: boolean;
  localNumber: string;
  operatorCode?: string;
};

export type PhoneInputProps = Omit<
  TextInputProps,
  "keyboardType" | "onChangeText" | "style" | "value"
> & {
  containerStyle?: StyleProp<ViewStyle>;
  errorText?: string;
  fieldStyle?: StyleProp<ViewStyle>;
  helperText?: string;
  inputStyle?: StyleProp<TextStyle>;
  label?: string;
  onChangeText?: (localNumber: string) => void;
  onE164Change?: (e164: string | null) => void;
  showValidationState?: boolean;
  value?: string;
};

const bdLocalPhonePattern = /^01[3-9]\d{8}$/;

function phoneDigits(input: string): string {
  return toLatinNumerals(input).replace(/\D/g, "");
}

export function normalizeBdPhoneNumber(input: string): string {
  const digits = phoneDigits(input);
  const normalizedInternational = digits.startsWith("00880") ? digits.slice(2) : digits;

  if (normalizedInternational.startsWith("880")) {
    const subscriber = normalizedInternational.slice(3);
    const localNumber = subscriber.startsWith("0") ? subscriber : `0${subscriber}`;
    return localNumber.slice(0, 11);
  }

  if (normalizedInternational.startsWith("0")) {
    return normalizedInternational.slice(0, 11);
  }

  if (normalizedInternational.startsWith("1")) {
    return `0${normalizedInternational}`.slice(0, 11);
  }

  return normalizedInternational.slice(0, 11);
}

export function validateBdPhoneNumber(input: string): BdPhoneValidationResult {
  const localNumber = normalizeBdPhoneNumber(input);

  if (localNumber.length !== 11) {
    return {
      e164: null,
      error: "invalid_length",
      isValid: false,
      localNumber
    };
  }

  if (!bdLocalPhonePattern.test(localNumber)) {
    return {
      e164: null,
      error: "invalid_prefix",
      isValid: false,
      localNumber
    };
  }

  return {
    e164: `+880${localNumber.slice(1)}`,
    isValid: true,
    localNumber,
    operatorCode: localNumber.slice(0, 3)
  };
}

export function isValidBdPhoneNumber(input: string): boolean {
  return validateBdPhoneNumber(input).isValid;
}

export function formatBdPhoneAfterPrefix(input: string): string {
  const localNumber = normalizeBdPhoneNumber(input);
  const nationalNumber = localNumber.startsWith("0") ? localNumber.slice(1) : localNumber;

  if (nationalNumber.length <= 4) {
    return nationalNumber;
  }

  return `${nationalNumber.slice(0, 4)}-${nationalNumber.slice(4, 10)}`;
}

export function PhoneInput({
  accessibilityLabel,
  containerStyle,
  editable = true,
  errorText,
  fieldStyle,
  helperText,
  inputStyle,
  label,
  onBlur,
  onChangeText,
  onE164Change,
  onFocus,
  placeholderTextColor = lightColors.inkMuted,
  showValidationState,
  value = "",
  ...props
}: PhoneInputProps) {
  const [focused, setFocused] = useState(false);
  const disabled = editable === false;
  const validation = validateBdPhoneNumber(value);
  const hasValidationError = Boolean(showValidationState && value.length > 0 && !validation.isValid);
  const supportText = errorText ?? helperText;
  const borderColor =
    errorText || hasValidationError
      ? lightColors.negative
      : showValidationState && validation.isValid
        ? lightColors.positive
        : focused
          ? lightColors.brandPrimary
          : lightColors.borderStrong;

  const handleFocus: NonNullable<TextInputProps["onFocus"]> = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur: NonNullable<TextInputProps["onBlur"]> = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  function handleChangeText(nextText: string) {
    const localNumber = normalizeBdPhoneNumber(nextText);
    const nextValidation = validateBdPhoneNumber(localNumber);
    onChangeText?.(localNumber);
    onE164Change?.(nextValidation.e164);
  }

  return (
    <View style={[{ gap: spacing.sm }, containerStyle]}>
      {label ? (
        <Text tone="secondary" variant="label">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          {
            alignItems: "center",
            backgroundColor: disabled ? lightColors.bgSubtle : lightColors.bgSurface,
            borderColor,
            borderRadius: radii.md,
            borderWidth: 1,
            flexDirection: "row",
            minHeight: 48,
            opacity: disabled ? 0.62 : 1,
            paddingHorizontal: spacing.lg
          },
          fieldStyle
        ]}
      >
        <Text selectable={false} tone="secondary" variant="bodyStrong">
          +880
        </Text>
        <View
          style={{
            backgroundColor: lightColors.borderSubtle,
            height: 24,
            marginHorizontal: spacing.md,
            width: 1
          }}
        />
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled }}
          accessibilityValue={{ text: validation.e164 ?? value }}
          autoComplete="tel"
          editable={editable}
          keyboardType="phone-pad"
          maxLength={11}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          placeholderTextColor={placeholderTextColor}
          style={[
            {
              color: lightColors.inkPrimary,
              flex: 1,
              fontSize: typography.body.fontSize,
              fontWeight: typography.body.fontWeight,
              lineHeight: typography.body.lineHeight,
              minHeight: 46,
              paddingVertical: 0
            },
            inputStyle
          ]}
          textContentType="telephoneNumber"
          value={formatBdPhoneAfterPrefix(value)}
          {...props}
        />
      </View>
      {supportText ? (
        <Text
          accessibilityRole={errorText || hasValidationError ? "alert" : "text"}
          selectable
          tone={errorText || hasValidationError ? "negative" : "muted"}
          variant="caption"
        >
          {supportText}
        </Text>
      ) : null}
    </View>
  );
}
