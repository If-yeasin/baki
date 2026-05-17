import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Button, type ButtonProps } from "./Button";
import { Text } from "./Text";
import { spacing } from "./theme/tokens";

export type EmptyStateAction = {
  accessibilityLabel?: string;
  label: string;
  onPress: ButtonProps["onPress"];
  variant?: ButtonProps["variant"];
};

export type EmptyStateProps = {
  action?: EmptyStateAction;
  body?: string;
  illustration?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
};

export function EmptyState({ action, body, illustration, style, testID, title }: EmptyStateProps) {
  return (
    <View
      accessibilityRole="summary"
      style={[{ alignItems: "center", gap: spacing.lg, padding: spacing["3xl"] }, style]}
      testID={testID}
    >
      {illustration}
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        <Text accessibilityRole="header" style={{ textAlign: "center" }} variant="h2">
          {title}
        </Text>
        {body ? (
          <Text style={{ textAlign: "center" }} tone="secondary" variant="body">
            {body}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Button
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          onPress={action.onPress}
          variant={action.variant ?? "primary"}
        >
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}
