import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { Text, radii, spacing, useTheme } from "@baki/ui";

type SettingsSectionProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  title?: string;
};

export function SettingsSection({ children, style, title }: SettingsSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {title ? (
        <Text style={{ color: colors.inkSecondary, paddingHorizontal: 2 }} variant="label">
          {title}
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.md,
          borderWidth: 1,
          overflow: "hidden"
        }}
      >
        {children}
      </View>
    </View>
  );
}

type SettingsRowProps = {
  accessibilityLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
  subtitle?: string;
  testID?: string;
  title: string;
  trailing?: ReactNode;
};

export function SettingsRow({
  accessibilityLabel,
  destructive = false,
  disabled = false,
  icon,
  onPress,
  showDivider = true,
  subtitle,
  testID,
  title,
  trailing
}: SettingsRowProps) {
  const { colors } = useTheme();
  const rowStyle = {
    alignItems: "center" as const,
    borderBottomColor: colors.rowDivider,
    borderBottomWidth: showDivider ? 1 : 0,
    flexDirection: "row" as const,
    gap: spacing.md,
    minHeight: 64,
    opacity: disabled ? 0.52 : 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  };
  const content = (
    <>
      <View
        style={{
          alignItems: "center",
          backgroundColor: destructive ? colors.tintNegative : colors.bgSubtle,
          borderRadius: radii.sm,
          height: 36,
          justifyContent: "center",
          width: 36
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text
          ellipsizeMode="tail"
          numberOfLines={2}
          tone={destructive ? "negative" : "primary"}
          variant="bodyStrong"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text ellipsizeMode="tail" numberOfLines={2} tone="muted" variant="caption">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          rowStyle,
          {
            backgroundColor: pressed ? colors.bgSubtle : colors.bgSurface,
            transform: [{ scale: pressed ? 0.99 : 1 }]
          }
        ]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel ?? title} style={rowStyle} testID={testID}>
      {content}
    </View>
  );
}

type SettingsStatusPillProps = {
  children: string;
  tone?: "brand" | "neutral";
};

export function SettingsStatusPill({ children, tone = "neutral" }: SettingsStatusPillProps) {
  const { colors } = useTheme();
  const isBrand = tone === "brand";

  return (
    <View
      style={{
        backgroundColor: isBrand ? colors.tintBrand : colors.bgSubtle,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs
      }}
    >
      <Text
        numberOfLines={1}
        style={{ color: isBrand ? colors.brandPrimary : colors.inkMuted }}
        variant="label"
      >
        {children}
      </Text>
    </View>
  );
}
