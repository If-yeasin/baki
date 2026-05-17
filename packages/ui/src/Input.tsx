import { type ReactNode, useState } from "react";
import {
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputFocusEventData,
  type TextInputProps,
  type TextStyle,
  type ViewStyle
} from "react-native";

import { Text } from "./Text";
import { lightColors, radii, spacing } from "./theme/tokens";
import { typography } from "./theme/typography";

export type InputProps = Omit<TextInputProps, "style"> & {
  containerStyle?: StyleProp<ViewStyle>;
  errorText?: string;
  fieldStyle?: StyleProp<ViewStyle>;
  helperText?: string;
  inputStyle?: StyleProp<TextStyle>;
  label?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function Input({
  accessibilityLabel,
  containerStyle,
  editable = true,
  errorText,
  fieldStyle,
  helperText,
  inputStyle,
  label,
  leading,
  onBlur,
  onFocus,
  placeholderTextColor = lightColors.inkMuted,
  trailing,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const disabled = editable === false;
  const supportText = errorText ?? helperText;
  const borderColor = errorText
    ? lightColors.negative
    : focused
      ? lightColors.brandPrimary
      : lightColors.borderStrong;

  function handleFocus(event: NativeSyntheticEvent<TextInputFocusEventData>) {
    setFocused(true);
    onFocus?.(event);
  }

  function handleBlur(event: NativeSyntheticEvent<TextInputFocusEventData>) {
    setFocused(false);
    onBlur?.(event);
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
            gap: spacing.sm,
            minHeight: 48,
            opacity: disabled ? 0.62 : 1,
            paddingHorizontal: spacing.lg
          },
          fieldStyle
        ]}
      >
        {leading ? <View pointerEvents="box-none">{leading}</View> : null}
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled }}
          editable={editable}
          onBlur={handleBlur}
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
          {...props}
        />
        {trailing ? <View pointerEvents="box-none">{trailing}</View> : null}
      </View>
      {supportText ? (
        <Text
          accessibilityRole={errorText ? "alert" : "text"}
          selectable
          tone={errorText ? "negative" : "muted"}
          variant="caption"
        >
          {supportText}
        </Text>
      ) : null}
    </View>
  );
}
