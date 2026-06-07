import { type SupportedLocale } from "@baki/i18n";
import i18next from "i18next";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { Avatar } from "./Avatar";
import { Money } from "./Money";
import { Text } from "./Text";
import { radii, spacing } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

export type MFSProvider = "bkash" | "nagad" | "cash" | "other";

export type MFSSettlementRowProps = {
  accessibilityLabel?: string;
  amountPaisa: number;
  disabled?: boolean;
  locale?: SupportedLocale;
  onPress: () => void;
  provider: MFSProvider;
  recipientName: string;
  style?: StyleProp<ViewStyle>;
};

const providerKey: Record<MFSProvider, string> = {
  bkash: "settle.via.bkash",
  cash: "settle.via.cash",
  nagad: "settle.via.nagad",
  other: "settle.via.other"
};

export function MFSSettlementRow({
  accessibilityLabel,
  amountPaisa,
  disabled,
  locale = "bn",
  onPress,
  provider,
  recipientName,
  style
}: MFSSettlementRowProps) {
  const { colors } = useTheme();
  const viaLabel = i18next.t(providerKey[provider]);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? `${viaLabel} — ${recipientName}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.sm,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing.md,
          minHeight: 58,
          opacity: disabled ? 0.48 : 1,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }]
        },
        style
      ]}
    >
      <Avatar name={recipientName} size="md" />
      <View style={{ flex: 1, flexShrink: 1, gap: spacing.xs }}>
        <Text variant="bodyStrong">{viaLabel}</Text>
        <Text numberOfLines={1} tone="secondary" variant="caption">
          {recipientName}
        </Text>
      </View>
      <Money amountPaisa={amountPaisa} locale={locale} />
    </Pressable>
  );
}
