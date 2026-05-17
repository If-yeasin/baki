import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { lightColors, radii, spacing } from "./theme/tokens";

export type DatePickerValue = Date | null | number | string;

export type DatePickerProps = Omit<PressableProps, "children" | "style"> & {
  displayValue?: string;
  errorText?: string;
  helperText?: string;
  label?: string;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
  value?: DatePickerValue;
};

export function DatePicker({
  accessibilityLabel,
  disabled,
  displayValue,
  errorText,
  helperText,
  label,
  placeholder,
  style,
  value,
  ...props
}: DatePickerProps) {
  const supportText = errorText ?? helperText;
  const renderedValue =
    displayValue ?? (typeof value === "string" || typeof value === "number" ? String(value) : "");
  const hasValue = renderedValue.length > 0;
  const isDisabled = disabled === true;

  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <Text tone="secondary" variant="label">
          {label}
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label ?? renderedValue ?? placeholder}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        style={({ pressed }) => [
          {
            alignItems: "center",
            backgroundColor: isDisabled ? lightColors.bgSubtle : lightColors.bgSurface,
            borderColor: errorText ? lightColors.negative : lightColors.borderStrong,
            borderRadius: radii.md,
            borderWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: 48,
            opacity: isDisabled ? 0.62 : 1,
            paddingHorizontal: spacing.lg,
            transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }]
          },
          style
        ]}
        {...props}
      >
        <Text tone={hasValue ? "primary" : "muted"} variant="body">
          {hasValue ? renderedValue : placeholder}
        </Text>
      </Pressable>
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
