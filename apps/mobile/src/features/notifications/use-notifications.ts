import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Database } from "@baki/db";

import { supabase } from "@/lib/supabase";

export type NotificationPreferences =
  Database["public"]["Tables"]["notification_preferences"]["Row"];

export type NotificationPreferencePatch = Partial<
  Pick<
    NotificationPreferences,
    "expense_activity" | "push_enabled" | "reminders" | "settlement_activity"
  >
>;

export const notificationKeys = {
  all: ["notifications"] as const,
  preferences: (userId: string) => [...notificationKeys.all, "preferences", userId] as const
};

const defaultPreferences = {
  expense_activity: true,
  push_enabled: true,
  reminders: true,
  settlement_activity: true
} satisfies NotificationPreferencePatch;

function getExpoProjectId() {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId
  );
}

async function requireSessionUserId() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user.id) {
    throw new Error("auth.error.session_failed");
  }

  return session.user.id;
}

export async function fetchNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("notification_preferences")
    .insert({
      user_id: userId,
      ...defaultPreferences
    })
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

export async function updateNotificationPreferences({
  patch,
  userId
}: {
  patch: NotificationPreferencePatch;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        ...defaultPreferences,
        ...patch
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function registerDeviceForPushNotifications() {
  const userId = await requireSessionUserId();
  const existingPermission = await Notifications.getPermissionsAsync();
  const permission =
    existingPermission.status === "granted"
      ? existingPermission
      : await Notifications.requestPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("notifications.permission_denied");
  }

  const projectId = getExpoProjectId();
  const token = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const { error } = await supabase.from("device_tokens").upsert(
    {
      expo_token: token.data,
      last_seen_at: new Date().toISOString(),
      platform: Platform.OS === "android" ? "android" : "ios",
      user_id: userId
    },
    { onConflict: "user_id,expo_token" }
  );

  if (error) {
    throw error;
  }

  await updateNotificationPreferences({
    patch: { push_enabled: true },
    userId
  });

  return token.data;
}

export function useNotificationPreferences(userId: string | null) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: () => fetchNotificationPreferences(userId as string),
    queryKey: userId ? notificationKeys.preferences(userId) : ["notifications", "unknown"]
  });
}

export function useUpdateNotificationPreferences(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: NotificationPreferencePatch) =>
      updateNotificationPreferences({
        patch,
        userId: userId as string
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(notificationKeys.preferences(data.user_id), data);
    }
  });
}

export function useRegisterDeviceForPushNotifications() {
  return useMutation({
    mutationFn: registerDeviceForPushNotifications
  });
}
