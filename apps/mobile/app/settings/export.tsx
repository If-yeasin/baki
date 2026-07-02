import { toBengaliNumerals } from "@baki/i18n";
import { Stack } from "expo-router";
import { Download, FileText } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { BakiEmptyState } from "@/components/baki-empty-state";
import { SettingsRow, SettingsSection } from "@/components/settings-section";
import { useShareGroupLedgerCsv } from "@/features/export/use-ledger-export";
import { useGroups } from "@/features/groups/use-groups";
import { usePreferencesStore } from "@/stores/preferences";
import { Skeleton, Text, Toast, spacing, useTheme } from "@baki/ui";

type ExportNotice = {
  body?: string;
  title: string;
  variant: "error" | "success";
};

function formatCount(count: number, locale: string) {
  return locale === "bn" ? toBengaliNumerals(count) : String(count);
}

export default function ExportSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const locale = usePreferencesStore((state) => state.locale);
  const groupsQuery = useGroups();
  const exportCsv = useShareGroupLedgerCsv();
  const [notice, setNotice] = useState<ExportNotice | null>(null);
  const groups = groupsQuery.data ?? [];

  function handleExport(groupId: string) {
    exportCsv.mutate(
      { groupId },
      {
        onError: () => {
          setNotice({
            title: t("settings.export.error.title"),
            variant: "error"
          });
        },
        onSuccess: (result) => {
          setNotice({
            body: t("settings.export.success.body", {
              count: formatCount(result.rowCount, locale)
            }),
            title: t("settings.export.success.title"),
            variant: "success"
          });
        }
      }
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["4xl"] }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Stack.Screen options={{ title: t("settings.export.title") }} />
      <Text style={{ color: colors.inkPrimary }} variant="h2">
        {t("settings.export.title")}
      </Text>
      <Text tone="secondary" variant="body">
        {t("settings.export.body")}
      </Text>

      {notice ? (
        <Toast
          dismissLabel={t("common.dismiss")}
          message={notice.body}
          onDismiss={() => setNotice(null)}
          title={notice.title}
          variant={notice.variant}
        />
      ) : null}

      <SettingsSection title={t("settings.export.khatas.title")}>
        {groupsQuery.isPending ? (
          <View style={{ gap: spacing.sm, padding: spacing.md }}>
            <Skeleton height={56} />
            <Skeleton height={56} />
          </View>
        ) : groups.length > 0 ? (
          groups.map((group, index) => (
            <SettingsRow
              disabled={exportCsv.isPending}
              icon={<FileText color={colors.brandPrimary} size={19} />}
              key={group.id}
              onPress={() => handleExport(group.id)}
              showDivider={index < groups.length - 1}
              subtitle={t(`groups.template.${group.template}`)}
              testID={`settings-export-group-${group.id}`}
              title={group.name}
              trailing={<Download color={colors.inkMuted} size={18} />}
            />
          ))
        ) : (
          <View style={{ padding: spacing.md }}>
            <BakiEmptyState
              body={t("settings.export.empty.body")}
              icon={FileText}
              title={t("settings.export.empty.title")}
              tone="gold"
            />
          </View>
        )}
      </SettingsSection>
    </ScrollView>
  );
}
