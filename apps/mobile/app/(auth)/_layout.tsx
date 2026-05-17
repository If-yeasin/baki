import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function AuthLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "#faf6ef" },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#faf6ef" },
        headerTintColor: "#0d1b1e",
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
