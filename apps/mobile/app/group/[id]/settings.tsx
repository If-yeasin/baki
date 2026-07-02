import { zodResolver } from "@hookform/resolvers/zod";
import { formatRelativeDhakaDate, toBengaliNumerals } from "@baki/i18n";
import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import {
  Archive,
  CalendarDays,
  Copy,
  Crown,
  RefreshCw,
  Share2,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, Share, View } from "react-native";
import { z } from "zod";

import { Button, Input, Text, Toast, radii, spacing, useTheme } from "@baki/ui";

import { GroupTemplateMark } from "@/components/ledger-marks";
import { SettingsRow, SettingsSection, SettingsStatusPill } from "@/components/settings-section";
import { useSession } from "@/features/auth/use-session";
import {
  useArchiveGroup,
  useDeleteGroup,
  useLeaveGroup,
  useRegenerateGroupInvite,
  useRenameGroup,
  useUpdateGroupTemplate
} from "@/features/groups/use-group-actions";
import { useGroupDetail } from "@/features/groups/use-group-detail";
import { GROUP_TEMPLATES, type GroupTemplate } from "@/features/groups/types";
import { usePreferencesStore } from "@/stores/preferences";

const renameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "groups.validation.name_required")
    .max(50, "groups.validation.name_too_long")
});

type RenameForm = z.infer<typeof renameSchema>;

type Notice = {
  body?: string;
  title: string;
  variant: "error" | "info" | "success" | "warning";
};

function groupActionErrorKey(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("outstanding_balance") || message.includes("outstanding_balances")) {
    return "groups.settings.error.outstanding";
  }
  if (message.includes("last_admin_cannot_leave")) {
    return "groups.settings.error.lastAdmin";
  }
  if (message.includes("creator_required")) {
    return "groups.settings.error.creatorRequired";
  }
  if (message.includes("admin_required")) {
    return "groups.settings.error.adminRequired";
  }
  return "groups.settings.error.generic";
}

export default function GroupSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? "";
  const session = useSession();
  const locale = usePreferencesStore((state) => state.locale);
  const { colors } = useTheme();
  const detailQuery = useGroupDetail(groupId);
  const renameGroup = useRenameGroup(groupId);
  const updateTemplate = useUpdateGroupTemplate(groupId);
  const archiveGroup = useArchiveGroup(groupId);
  const leaveGroup = useLeaveGroup(groupId);
  const deleteGroup = useDeleteGroup(groupId);
  const regenerateInvite = useRegenerateGroupInvite(groupId);
  const [notice, setNotice] = useState<Notice | null>(null);

  const group = detailQuery.data?.group;
  const members = detailQuery.data?.members ?? [];
  const currentMember = members.find((member) => member.userId === session.userId);
  const isAdmin = currentMember?.role.toLowerCase() === "admin";
  const isCreator = group?.createdBy === session.userId;
  const inviteCode = group?.inviteCode ? group.inviteCode.toUpperCase() : "";
  const inviteLink = inviteCode ? `baki://groups/join?code=${inviteCode}` : "";
  const createdLabel = group
    ? formatRelativeDhakaDate(group.createdAt, locale)
    : t("common.loading");
  const memberCountLabel = t(
    members.length === 1 ? "groups.detail.members_count_one" : "groups.detail.members_count",
    { count: locale === "bn" ? toBengaliNumerals(members.length) : String(members.length) }
  );

  const {
    control,
    formState: { errors },
    handleSubmit,
    reset
  } = useForm<RenameForm>({
    defaultValues: { name: "" },
    resolver: zodResolver(renameSchema)
  });

  useEffect(() => {
    if (group?.name) {
      reset({ name: group.name });
    }
  }, [group?.name, reset]);

  const templateItems = useMemo(
    () =>
      GROUP_TEMPLATES.map((template) => ({
        label: t(`groups.template.${template}`),
        template
      })),
    [t]
  );

  const onRename = handleSubmit(async (values) => {
    try {
      await renameGroup.mutateAsync(values.name);
      setNotice({ title: t("groups.settings.rename.success"), variant: "success" });
    } catch (error) {
      setNotice({ title: t(groupActionErrorKey(error)), variant: "error" });
    }
  });

  async function handleTemplateChange(template: GroupTemplate) {
    try {
      await updateTemplate.mutateAsync(template);
      setNotice({ title: t("groups.settings.template.success"), variant: "success" });
    } catch (error) {
      setNotice({ title: t(groupActionErrorKey(error)), variant: "error" });
    }
  }

  async function handleCopyInvite() {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setNotice({
      body: t("groups.invite.copied.body"),
      title: t("groups.invite.copied.title"),
      variant: "success"
    });
  }

  async function handleShareInvite() {
    if (!inviteCode) return;
    await Share.share({
      message: t("groups.settings.invite.shareMessage", {
        code: inviteCode,
        link: inviteLink
      })
    });
  }

  async function handleRegenerateInvite() {
    try {
      const code = await regenerateInvite.mutateAsync();
      await Clipboard.setStringAsync(code);
      setNotice({
        body: t("groups.settings.invite.regenerated.body", { code }),
        title: t("groups.settings.invite.regenerated.title"),
        variant: "success"
      });
    } catch (error) {
      setNotice({ title: t(groupActionErrorKey(error)), variant: "error" });
    }
  }

  function confirmArchive() {
    Alert.alert(t("groups.settings.archive.confirm.title"), t("groups.settings.archive.confirm.body"), [
      { style: "cancel", text: t("common.cancel") },
      {
        onPress: async () => {
          try {
            await archiveGroup.mutateAsync();
            setNotice({ title: t("groups.settings.archive.success"), variant: "success" });
          } catch (error) {
            setNotice({ title: t(groupActionErrorKey(error)), variant: "error" });
          }
        },
        text: t("groups.settings.archive.cta")
      }
    ]);
  }

  function confirmLeave() {
    Alert.alert(t("groups.settings.leave.confirm.title"), t("groups.settings.leave.confirm.body"), [
      { style: "cancel", text: t("common.cancel") },
      {
        onPress: async () => {
          try {
            await leaveGroup.mutateAsync();
            router.replace("/" as Href);
          } catch (error) {
            setNotice({ title: t(groupActionErrorKey(error)), variant: "error" });
          }
        },
        style: "destructive",
        text: t("groups.settings.leave.cta")
      }
    ]);
  }

  function confirmDelete() {
    Alert.alert(t("groups.settings.delete.confirm.title"), t("groups.settings.delete.confirm.body"), [
      { style: "cancel", text: t("common.cancel") },
      {
        onPress: async () => {
          try {
            await deleteGroup.mutateAsync();
            router.replace("/" as Href);
          } catch (error) {
            setNotice({ title: t(groupActionErrorKey(error)), variant: "error" });
          }
        },
        style: "destructive",
        text: t("groups.settings.delete.cta")
      }
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={{
        gap: spacing.lg,
        padding: spacing.lg,
        paddingBottom: spacing["4xl"]
      }}
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
    >
      <Stack.Screen options={{ title: t("groups.settings.title") }} />

      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.inkPrimary }} variant="h2">
          {t("groups.settings.title")}
        </Text>
        <Text style={{ color: colors.inkSecondary }} variant="body">
          {group?.name ?? t("groups.detail.fallback_title")}
        </Text>
      </View>

      {notice ? (
        <Toast
          dismissLabel={t("common.dismiss")}
          message={notice.body}
          onDismiss={() => setNotice(null)}
          testID="group-settings-notice"
          title={notice.title}
          variant={notice.variant}
        />
      ) : null}

      <SettingsSection title={t("groups.settings.section.summary")}>
        <SettingsRow
          icon={<Users color={colors.brandPrimary} size={19} />}
          subtitle={memberCountLabel}
          title={t("groups.detail.members.title")}
        />
        <SettingsRow
          icon={<CalendarDays color={colors.brandPrimary} size={19} />}
          subtitle={createdLabel}
          title={t("groups.settings.created")}
        />
        <SettingsRow
          icon={<Crown color={colors.accentGold} size={19} />}
          subtitle={
            isCreator
              ? t("groups.settings.role.creator")
              : isAdmin
                ? t("groups.detail.members.admin")
                : t("groups.detail.members.member")
          }
          title={t("groups.settings.role.title")}
          trailing={
            isAdmin ? (
              <SettingsStatusPill tone="brand">{t("groups.detail.members.admin")}</SettingsStatusPill>
            ) : undefined
          }
        />
      </SettingsSection>

      <SettingsSection title={t("groups.settings.section.identity")}>
        <View style={{ gap: spacing.md, padding: spacing.md }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onBlur, onChange, value } }) => (
              <Input
                accessibilityLabel={t("groups.create.name.label")}
                editable={isAdmin}
                errorText={errors.name?.message ? t(errors.name.message) : undefined}
                fieldStyle={{
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderStrong,
                  borderRadius: radii.md
                }}
                inputStyle={{ color: colors.inkPrimary }}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder={t("groups.create.name.placeholder")}
                placeholderTextColor={colors.inkMuted}
                testID="group-settings-name-input"
                value={value}
              />
            )}
          />
          <Button disabled={!isAdmin || renameGroup.isPending} onPress={onRename} size="md">
            {renameGroup.isPending ? t("common.loading") : t("groups.settings.rename.cta")}
          </Button>
        </View>
      </SettingsSection>

      <SettingsSection title={t("groups.create.template.label")}>
        <View style={{ gap: spacing.sm, padding: spacing.md }}>
          {templateItems.map((item) => {
            const selected = group?.template === item.template;
            return (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="button"
                accessibilityState={{ disabled: !isAdmin, selected }}
                disabled={!isAdmin || updateTemplate.isPending}
                key={item.template}
                onPress={() => handleTemplateChange(item.template)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: selected ? colors.tintBrand : colors.bgSurface,
                  borderColor: selected ? colors.brandPrimary : colors.borderSubtle,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: spacing.md,
                  minHeight: 58,
                  opacity: !isAdmin ? 0.56 : pressed ? 0.78 : 1,
                  paddingHorizontal: spacing.md
                })}
              >
                <GroupTemplateMark size={36} template={item.template} />
                <Text style={{ color: colors.inkPrimary, flex: 1 }} variant="bodyStrong">
                  {item.label}
                </Text>
                {selected ? <ShieldCheck color={colors.brandPrimary} size={18} /> : null}
              </Pressable>
            );
          })}
        </View>
      </SettingsSection>

      <SettingsSection title={t("groups.settings.section.invite")}>
        <SettingsRow
          icon={<Copy color={colors.brandPrimary} size={19} />}
          onPress={handleCopyInvite}
          subtitle={inviteCode}
          testID="group-settings-copy-invite"
          title={t("groups.invite.copy.cta")}
        />
        <SettingsRow
          icon={<Share2 color={colors.brandPrimary} size={19} />}
          onPress={handleShareInvite}
          subtitle={inviteLink}
          testID="group-settings-share-invite"
          title={t("groups.invite.share.cta")}
        />
        <SettingsRow
          disabled={!isAdmin || regenerateInvite.isPending}
          icon={<RefreshCw color={colors.warning} size={19} />}
          onPress={handleRegenerateInvite}
          showDivider={false}
          subtitle={t("groups.settings.invite.regenerate.subtitle")}
          testID="group-settings-regenerate-invite"
          title={t("groups.settings.invite.regenerate.title")}
        />
      </SettingsSection>

      <SettingsSection title={t("groups.settings.section.safety")}>
        <SettingsRow
          disabled={!isAdmin || archiveGroup.isPending}
          icon={<Archive color={colors.warning} size={19} />}
          onPress={confirmArchive}
          subtitle={t("groups.settings.archive.subtitle")}
          title={t("groups.settings.archive.cta")}
        />
        <SettingsRow
          destructive
          disabled={leaveGroup.isPending}
          icon={<UserMinus color={colors.negative} size={19} />}
          onPress={confirmLeave}
          subtitle={t("groups.settings.leave.subtitle")}
          title={t("groups.settings.leave.cta")}
        />
        <SettingsRow
          destructive
          disabled={!isCreator || deleteGroup.isPending}
          icon={<Trash2 color={colors.negative} size={19} />}
          onPress={confirmDelete}
          showDivider={false}
          subtitle={
            isCreator
              ? t("groups.settings.delete.subtitle")
              : t("groups.settings.delete.creatorOnly")
          }
          title={t("groups.settings.delete.cta")}
        />
      </SettingsSection>
    </ScrollView>
  );
}
