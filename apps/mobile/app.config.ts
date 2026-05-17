import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "বাকি",
  slug: "baki",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "baki",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  assetBundlePatterns: ["**/*"],
  icon: "./assets/icons/icon.png",
  ios: {
    bundleIdentifier: "com.baki.app",
    supportsTablet: false,
    infoPlist: {
      LSApplicationQueriesSchemes: ["bkashopen", "nagad"]
    }
  },
  android: {
    package: "com.baki.app",
    adaptiveIcon: {
      backgroundColor: "#0d7c66",
      foregroundImage: "./assets/icons/adaptive-icon.png"
    }
  },
  plugins: [
    "expo-router",
    "expo-font",
    [
      "expo-notifications",
      {
        icon: "./assets/icons/notification-icon.png",
        color: "#0d7c66"
      }
    ],
    "@sentry/react-native/expo"
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID
    },
    enableBkash: process.env.EXPO_PUBLIC_ENABLE_BKASH ?? "true",
    enableNagad: process.env.EXPO_PUBLIC_ENABLE_NAGAD ?? "true",
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL
  }
};

export default config;
