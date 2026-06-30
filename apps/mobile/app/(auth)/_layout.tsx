import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "@baki/ui";

export default function AuthLayout() {
  return <AuthStack />;
}

function AuthStack() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.bgCanvas },
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bgCanvas },
        headerTintColor: colors.inkPrimary,
        headerTitleStyle: {
          fontFamily: "HindSiliguri_600SemiBold"
        }
      }}
    >
      <Stack.Screen name="phone" options={{ title: t("auth.phone.title") }} />
      <Stack.Screen name="otp" options={{ title: t("auth.otp.title") }} />
      <Stack.Screen name="profile" options={{ title: t("auth.profile.title") }} />
    </Stack>
  );
}
