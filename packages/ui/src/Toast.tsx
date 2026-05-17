import { View, type StyleProp, type ViewStyle } from "react-native";

import { Button } from "./Button";
import { Text } from "./Text";
import { lightColors, radii, spacing } from "./theme/tokens";

type ToastVariant = "error" | "info" | "neutral" | "success" | "warning";

export type ToastAction = {
  accessibilityLabel?: string;
  label: string;
  onPress: () => void;
};

export type ToastProps = {
  accessibilityLabel?: string;
  action?: ToastAction;
  dismissLabel?: string;
  message?: string;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
  variant?: ToastVariant;
  visible?: boolean;
};

const toastAccent: Record<ToastVariant, string> = {
  error: lightColors.negative,
  info: lightColors.info,
  neutral: lightColors.borderStrong,
  success: lightColors.positive,
  warning: lightColors.warning
};

export function Toast({
  accessibilityLabel,
  action,
  dismissLabel,
  message,
  onDismiss,
  style,
  testID,
  title,
  variant = "neutral",
  visible = true
}: ToastProps) {
  if (!visible) {
    return null;
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? [title, message].filter(Boolean).join(". ")}
      accessibilityLiveRegion={variant === "error" ? "assertive" : "polite"}
      accessibilityRole="alert"
      style={[
        {
          backgroundColor: lightColors.bgSurface,
          borderColor: lightColors.borderSubtle,
          borderLeftColor: toastAccent[variant],
          borderLeftWidth: 4,
          borderRadius: radii.md,
          borderWidth: 1,
          gap: spacing.md,
          minHeight: 64,
          padding: spacing.lg
        },
        style
      ]}
      testID={testID}
    >
      <View style={{ gap: spacing.xs }}>
        <Text variant="bodyStrong">{title}</Text>
        {message ? (
          <Text selectable tone="secondary" variant="caption">
            {message}
          </Text>
        ) : null}
      </View>
      {action || (onDismiss && dismissLabel) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {action ? (
            <Button
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              onPress={action.onPress}
              size="sm"
            >
              {action.label}
            </Button>
          ) : null}
          {onDismiss && dismissLabel ? (
            <Button onPress={onDismiss} size="sm" variant="ghost">
              {dismissLabel}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
