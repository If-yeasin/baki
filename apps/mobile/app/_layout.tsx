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
import { Component, type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Text as RNText, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemeProvider, lightColors, useTheme } from "@baki/ui";

import { i18n } from "@/lib/i18n";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { useQueuedMutationProcessor } from "@/features/offline/use-queued-mutation-processor";
import { queryClient } from "@/lib/query-client";
import { Sentry } from "@/lib/sentry";
import { usePreferencesStore } from "@/stores/preferences";

void SplashScreen.preventAutoHideAsync();

function RootLayout() {
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
    <GestureHandlerRootView style={{ backgroundColor: lightColors.bgCanvas, flex: 1 }}>
      <RootErrorBoundary>
        <AppThemeProvider>
          <QueryClientProvider client={queryClient}>
            <QueuedMutationProcessor />
            <RootStack />
          </QueryClientProvider>
        </AppThemeProvider>
      </RootErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

class RootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[RootErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          accessibilityRole="alert"
          style={{
            alignItems: "center",
            backgroundColor: lightColors.bgCanvas,
            flex: 1,
            justifyContent: "center",
            padding: 24
          }}
        >
          <RNText style={{ color: lightColors.inkPrimary, textAlign: "center" }}>
            {i18n.t("common.error.generic")}
          </RNText>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootStack() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.bgCanvas },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bgCanvas },
        headerTintColor: colors.inkPrimary,
        headerRight: () => <SyncStatusIndicator />,
        headerTitleStyle: {
          fontFamily: "HindSiliguri_600SemiBold"
        }
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="e2e/seed-auth" options={{ headerShown: false }} />
      <Stack.Screen name="groups/create" options={{ title: t("groups.create.title") }} />
      <Stack.Screen name="groups/join" options={{ title: t("groups.join.title") }} />
      <Stack.Screen name="settings/export" options={{ title: t("settings.export.title") }} />
      <Stack.Screen
        name="settings/notifications"
        options={{ title: t("settings.notifications.title") }}
      />
      <Stack.Screen name="settings/privacy" options={{ title: t("settings.privacy.title") }} />
      <Stack.Screen name="settings/support" options={{ title: t("settings.support.title") }} />
      <Stack.Screen name="settings/sync" options={{ title: t("sync.details.title") }} />
      <Stack.Screen name="settings/terms" options={{ title: t("settings.terms.title") }} />
      <Stack.Screen
        name="group/[id]/index"
        options={{ title: t("groups.detail.fallback_title") }}
      />
      <Stack.Screen name="group/[id]/add-expense" options={{ title: t("expense.add.title") }} />
      <Stack.Screen
        name="group/[id]/activity"
        options={{ title: t("groups.detail.activity.title") }}
      />
      <Stack.Screen name="group/[id]/settings" options={{ title: t("groups.settings.title") }} />
      <Stack.Screen name="group/[id]/settle" options={{ title: t("settle.title") }} />
    </Stack>
  );
}

function QueuedMutationProcessor() {
  useQueuedMutationProcessor();
  return null;
}

function AppThemeProvider({ children }: { children: ReactNode }) {
  const themePreference = usePreferencesStore((state) => state.theme);

  return <ThemeProvider override={themePreference}>{children}</ThemeProvider>;
}
