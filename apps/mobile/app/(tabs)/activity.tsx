import { formatRelativeDhakaDate } from "@baki/i18n";
import { useRouter, type Href } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState, Text, radii, spacing, useTheme } from "@baki/ui";

import { useGroups } from "@/features/groups/use-groups";
import { usePreferencesStore } from "@/stores/preferences";

export default function ActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const locale = usePreferencesStore((state) => state.locale);
  const groupsQuery = useGroups();
  const groups = groupsQuery.data ?? [];
  const firstGroupId = groups[0]?.id;
  const addTarget = firstGroupId
    ? (`/group/${firstGroupId}/add-expense` as Href)
    : ("/groups/create" as Href);
  const addLabel = firstGroupId ? t("expense.add.title") : t("groups.create.cta");

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.lg,
          padding: spacing.lg,
          paddingBottom: spacing["5xl"]
        }}
        style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
          <Text style={{ color: colors.inkPrimary, flex: 1 }} variant="h2">
            {t("groups.detail.activity.title")}
          </Text>
          <View
            accessibilityLabel={t("groups.detail.activity.title")}
            accessibilityRole="search"
            style={{
              alignItems: "center",
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.pill,
              borderWidth: 1,
              height: 44,
              justifyContent: "center",
              width: 44
            }}
          >
            <Search color={colors.inkMuted} size={18} />
          </View>
        </View>

        {groups.length > 0 ? (
          <View style={{ overflow: "hidden" }}>
            {groups.map((group) => (
              <View
                key={group.id}
                style={{
                  backgroundColor: colors.bgSurface,
                  borderBottomColor: colors.rowDivider,
                  borderBottomWidth: 1,
                  flexDirection: "row",
                  gap: spacing.md,
                  minHeight: 68,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.tintBrand,
                    borderRadius: radii.pill,
                    height: 36,
                    justifyContent: "center",
                    width: 36
                  }}
                >
                  <Plus color={colors.brandPrimary} size={18} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkPrimary }}
                    variant="bodyStrong"
                  >
                    {group.name}
                  </Text>
                  <Text style={{ color: colors.inkMuted }} variant="caption">
                    {t("groups.create.title")}
                  </Text>
                </View>
                <Text style={{ color: colors.inkMuted }} variant="caption">
                  {formatRelativeDhakaDate(group.updatedAt, locale)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              borderWidth: 1,
              padding: spacing.lg
            }}
          >
            <EmptyState body={t("home.empty.body")} title={t("groups.detail.activity.title")} />
          </View>
        )}
      </ScrollView>
      <Pressable
        accessibilityLabel={addLabel}
        accessibilityRole="button"
        onPress={() => router.push(addTarget)}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.brandPrimary,
          borderRadius: radii.pill,
          bottom: spacing["2xl"],
          height: 58,
          justifyContent: "center",
          opacity: pressed ? 0.86 : 1,
          position: "absolute",
          right: spacing.lg,
          width: 58
        })}
        testID="activity-add-expense-fab"
      >
        <Plus color={colors.bgCanvas} size={28} />
      </Pressable>
    </View>
  );
}
