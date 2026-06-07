import { View, type StyleProp, type ViewStyle } from "react-native";

import { Button } from "./Button";
import { Text } from "./Text";
import { radii, spacing } from "./theme/tokens";
import { useTheme, type ThemeColors } from "./theme/useTheme";

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

function accentFor(colors: ThemeColors, variant: ToastVariant): string {
  switch (variant) {
    case "error":
      return colors.negative;
    case "info":
      return colors.info;
    case "success":
      return colors.positive;
    case "warning":
      return colors.warning;
    case "neutral":
    default:
      return colors.borderStrong;
  }
}

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
  const { colors } = useTheme();

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
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderLeftColor: accentFor(colors, variant),
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
