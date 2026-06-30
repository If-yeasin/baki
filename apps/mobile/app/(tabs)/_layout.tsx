import { Tabs } from "expo-router";
import { Activity, ListChecks, ScrollText, Settings as SettingsIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@baki/ui";

import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerRight: () => <SyncStatusIndicator />,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bgSurface },
        headerTintColor: colors.inkPrimary,
        headerTitleStyle: { fontFamily: "HindSiliguri_600SemiBold" },
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontFamily: "HindSiliguri_500Medium", fontSize: 12 },
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.borderSubtle,
          height: 76,
          paddingBottom: 12,
          paddingTop: 4
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => <ScrollText color={color} size={size} />,
          tabBarLabel: t("groups.list.title"),
          tabBarButtonTestID: "tab-groups",
          title: t("groups.list.title")
        }}
      />
      <Tabs.Screen
        name="balances"
        options={{
          tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} />,
          tabBarLabel: t("groups.detail.balances.title"),
          tabBarButtonTestID: "tab-balances",
          title: t("groups.detail.balances.title")
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ color, size }) => <Activity color={color} size={size} />,
          tabBarLabel: t("groups.detail.activity.title"),
          tabBarButtonTestID: "tab-activity",
          title: t("groups.detail.activity.title")
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
          tabBarLabel: t("settings.title"),
          tabBarButtonTestID: "tab-settings",
          title: t("settings.title")
        }}
      />
    </Tabs>
  );
}
