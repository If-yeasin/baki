import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { Text, spacing, useTheme } from "@baki/ui";

import { useSession } from "@/features/auth/use-session";

export default function RootGate() {
  const { t } = useTranslation();
  const { isLoading, userId } = useSession();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View
        accessibilityRole="progressbar"
        style={{
          alignItems: "center",
          backgroundColor: colors.bgCanvas,
          flex: 1,
          gap: spacing.md,
          justifyContent: "center"
        }}
      >
        <ActivityIndicator color={colors.brandPrimary} size="large" />
        <Text tone="secondary">{t("common.loading")}</Text>
      </View>
    );
  }

  if (userId) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/phone" />;
}
