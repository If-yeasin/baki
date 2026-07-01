import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  View,
  type DimensionValue,
  type ModalProps,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { Button } from "./Button";
import { Text } from "./Text";
import { radii, spacing } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

export type SheetSnapPoint = DimensionValue;

export type SheetProps = Omit<
  ModalProps,
  "children" | "onRequestClose" | "transparent" | "visible"
> & {
  children: ReactNode;
  closeLabel?: string;
  contentStyle?: StyleProp<ViewStyle>;
  description?: string;
  dismissible?: boolean;
  footer?: ReactNode;
  onClose?: () => void;
  snapPoints?: readonly SheetSnapPoint[];
  style?: StyleProp<ViewStyle>;
  title?: string;
  visible: boolean;
};

function resolveMaxHeight(snapPoints?: readonly SheetSnapPoint[]): DimensionValue {
  return snapPoints?.[snapPoints.length - 1] ?? "90%";
}

export function Sheet({
  animationType = "slide",
  children,
  closeLabel,
  contentStyle,
  description,
  dismissible = true,
  footer,
  onClose,
  snapPoints,
  style,
  title,
  visible,
  ...props
}: SheetProps) {
  const { colors } = useTheme();

  return (
    <Modal
      animationType={animationType}
      onRequestClose={onClose}
      transparent
      visible={visible}
      {...props}
    >
      <View
        style={[
          {
            // Slightly heavier scrim in dark so the surface step is legible.
            backgroundColor: "rgba(0, 0, 0, 0.52)",
            flex: 1,
            justifyContent: "flex-end"
          },
          style
        ]}
      >
        <Pressable
          accessible={false}
          disabled={!dismissible || !onClose}
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <View
          accessibilityViewIsModal
          style={[
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderWidth: 1,
              gap: spacing.lg,
              maxHeight: resolveMaxHeight(snapPoints),
              padding: spacing.xl
            },
            contentStyle
          ]}
        >
          {title || (onClose && closeLabel) ? (
            <View
              style={{
                alignItems: "flex-start",
                flexDirection: "row",
                gap: spacing.md,
                justifyContent: "space-between"
              }}
            >
              <View style={{ flex: 1, gap: spacing.xs }}>
                {title ? (
                  <Text accessibilityRole="header" variant="h3">
                    {title}
                  </Text>
                ) : null}
                {description ? (
                  <Text tone="secondary" variant="caption">
                    {description}
                  </Text>
                ) : null}
              </View>
              {onClose && closeLabel ? (
                <Button onPress={onClose} size="sm" variant="ghost">
                  {closeLabel}
                </Button>
              ) : null}
            </View>
          ) : null}
          <View style={{ gap: spacing.lg }}>{children}</View>
          {footer ? <View>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
