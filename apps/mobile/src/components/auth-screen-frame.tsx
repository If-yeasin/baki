import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { Text, radii, spacing, useTheme } from "@baki/ui";

export type AuthScreenFrameProps = {
  backLabel?: string;
  brandLabel: string;
  children: ReactNode;
  eyebrow: string;
  icon: LucideIcon;
  onBack?: () => void;
  subtitle: string;
  title: string;
};

export function AuthScreenFrame({
  backLabel,
  brandLabel,
  children,
  eyebrow,
  icon: Icon,
  onBack,
  subtitle,
  title
}: AuthScreenFrameProps) {
  const { colors } = useTheme();

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing["4xl"] }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
      >
        <View
          style={{
            backgroundColor: colors.brandPrimary,
            gap: spacing.lg,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing["3xl"]
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
            {onBack ? (
              <Pressable
                accessibilityLabel={backLabel}
                accessibilityRole="button"
                onPress={onBack}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: radii.pill,
                  height: 40,
                  justifyContent: "center",
                  opacity: pressed ? 0.72 : 1,
                  width: 40
                })}
              >
                <ArrowLeft color={colors.inkOnBrand} size={20} />
              </Pressable>
            ) : null}
            <View
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: radii.pill,
                flexDirection: "row",
                gap: spacing.sm,
                minHeight: 40,
                paddingHorizontal: spacing.md
              }}
            >
              <Icon color={colors.inkOnBrand} size={18} />
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={{ color: colors.inkOnBrand }}
                variant="label"
              >
                {brandLabel}
              </Text>
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.inkOnBrand, opacity: 0.82 }} variant="label">
              {eyebrow}
            </Text>
            <Text
              ellipsizeMode="tail"
              numberOfLines={2}
              style={{ color: colors.inkOnBrand }}
              variant="h1"
            >
              {title}
            </Text>
            <Text style={{ color: colors.inkOnBrand, opacity: 0.88 }} variant="body">
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.lg, padding: spacing.xl }}>{children}</View>
      </ScrollView>
    </View>
  );
}
