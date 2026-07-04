import type { ExpoConfig } from "expo/config";

const e2eMode = process.env.EXPO_PUBLIC_E2E_MODE === "true";
const easBuildProfile = process.env.EAS_BUILD_PROFILE ?? "";
const appChannel = process.env.EXPO_PUBLIC_APP_CHANNEL ?? "";
const supabaseEnv = process.env.EXPO_PUBLIC_SUPABASE_ENV ?? "";
const productionMarkers = new Set(["production", "prod"]);
const allowedE2ESupabaseEnvs = new Set(["local", "preview", "test"]);
const isProductionVariant =
  productionMarkers.has(easBuildProfile.toLowerCase()) ||
  productionMarkers.has(appChannel.toLowerCase());

if (e2eMode && isProductionVariant) {
  throw new Error("EXPO_PUBLIC_E2E_MODE cannot be enabled for production builds.");
}

if (e2eMode && !allowedE2ESupabaseEnvs.has(supabaseEnv.toLowerCase())) {
  throw new Error("EXPO_PUBLIC_E2E_MODE requires EXPO_PUBLIC_SUPABASE_ENV=local|preview|test.");
}

if (isProductionVariant) {
  const requiredProductionEnv = [
    "EAS_PROJECT_ID",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_SUPABASE_URL"
  ];
  const missingProductionEnv = requiredProductionEnv.filter((key) => !process.env[key]);

  if (missingProductionEnv.length > 0) {
    throw new Error(
      `Production builds require ${missingProductionEnv.join(", ")} to be configured.`
    );
  }

  if (supabaseEnv.toLowerCase() !== "production") {
    throw new Error("Production builds require EXPO_PUBLIC_SUPABASE_ENV=production.");
  }
}

const config: ExpoConfig = {
  name: "বাকি",
  slug: "baki",
  version: "0.9.0",
  orientation: "portrait",
  scheme: "baki",
  userInterfaceStyle: "automatic",
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
    reactCompiler: true,
    typedRoutes: true
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID
    },
    enableBkash: process.env.EXPO_PUBLIC_ENABLE_BKASH ?? "true",
    enableNagad: process.env.EXPO_PUBLIC_ENABLE_NAGAD ?? "true",
    appChannel,
    easBuildProfile,
    e2eMode: e2eMode ? "true" : "false",
    e2eSeedEmail: e2eMode
      ? (process.env.EXPO_PUBLIC_E2E_SEED_EMAIL ?? "rini@example.test")
      : undefined,
    e2eSeedPassword: e2eMode
      ? (process.env.EXPO_PUBLIC_E2E_SEED_PASSWORD ?? "password")
      : undefined,
    e2eSeedUserId: e2eMode
      ? (process.env.EXPO_PUBLIC_E2E_SEED_USER_ID ??
          "22222222-2222-4222-8222-222222222222")
      : undefined,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseEnv,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL
  }
};

export default config;
