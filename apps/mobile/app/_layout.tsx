import "../global.css";

import {
  HindSiliguri_400Regular,
  HindSiliguri_500Medium,
  HindSiliguri_600SemiBold,
  HindSiliguri_700Bold,
  useFonts as useHindSiliguriFonts
} from "@expo-google-fonts/hind-siliguri";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import "@/lib/i18n";
import { queryClient } from "@/lib/query-client";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [hindLoaded] = useHindSiliguriFonts({
    HindSiliguri_400Regular,
    HindSiliguri_500Medium,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold
  });
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold
  });

  const fontsLoaded = hindLoaded && interLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
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
          <Stack.Screen name="index" options={{ title: "বাকি" }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
