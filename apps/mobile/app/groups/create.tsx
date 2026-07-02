import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useRouter, type Href } from "expo-router";
import { ArrowLeft, Check, Share2, UsersRound, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { z } from "zod";

import { Button, Input, Text, Toast, radii, spacing, useTheme } from "@baki/ui";

import { GroupTemplateMark } from "@/components/ledger-marks";
import { useCreateGroup } from "@/features/groups/use-create-group";
import { GROUP_TEMPLATES, type GroupTemplate } from "@/features/groups/types";

const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "groups.validation.name_required")
    .max(50, "groups.validation.name_too_long"),
  template: z.enum(["mess", "family", "trip", "event", "custom"])
});

type CreateGroupForm = z.infer<typeof createGroupSchema>;

export default function CreateGroupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const createGroup = useCreateGroup();
  const { colors } = useTheme();
  const {
    control,
    formState: { errors },
    handleSubmit
  } = useForm<CreateGroupForm>({
    defaultValues: { name: "", template: "custom" },
    resolver: zodResolver(createGroupSchema)
  });
  const watchedName = useWatch({ control, name: "name" });
  const watchedTemplate = useWatch({ control, name: "template" });
  const [queuedNoticeVisible, setQueuedNoticeVisible] = useState(false);
  const previewName = watchedName.trim() || t("groups.create.name.placeholder");
  const previewTemplate = watchedTemplate ?? "custom";

  const onSubmit = handleSubmit(async (values) => {
    const result = await createGroup.mutateAsync(values);

    if (result.status === "queued") {
      setQueuedNoticeVisible(true);
      return;
    }

    router.replace(`/group/${result.group.id}` as Href);
  });

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, title: t("groups.create.title") }} />
      <View
        style={{
          backgroundColor: colors.brandPrimary,
          gap: spacing.lg,
          paddingBottom: spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing["3xl"]
        }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
          <Pressable
            accessibilityLabel={t("common.cancel")}
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.18)",
              borderRadius: radii.pill,
              height: 40,
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
              width: 40
            })}
          >
            <ArrowLeft color={colors.inkOnBrand} size={20} />
          </Pressable>
          <Text style={{ color: colors.inkOnBrand, flex: 1, minWidth: 0 }} variant="h2">
            {t("groups.create.title")}
          </Text>
        </View>
        <Text style={{ color: colors.inkOnBrand, opacity: 0.88 }} variant="body">
          {t("groups.create.subtitle")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          gap: spacing.lg,
          padding: spacing.xl,
          paddingBottom: spacing.xl
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {queuedNoticeVisible ? (
          <Toast
            dismissLabel={t("common.dismiss")}
            message={t("sync.offline.saved.body")}
            onDismiss={() => setQueuedNoticeVisible(false)}
            testID="group-queued-notice"
            title={t("sync.offline.saved.title")}
            variant="success"
          />
        ) : null}

        <View
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderStrong,
            borderRadius: radii.md,
            borderWidth: 1,
            gap: spacing.md,
            padding: spacing.lg
          }}
        >
          <Text style={{ color: colors.inkMuted }} variant="label">
            {t("groups.create.preview.label")}
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
            <GroupTemplateMark size={52} template={previewTemplate} />
            <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={{ color: colors.inkPrimary }}
                variant="bodyStrong"
              >
                {previewName}
              </Text>
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={{ color: colors.inkMuted }}
                variant="caption"
              >
                {t(`groups.template.${previewTemplate}`)}
              </Text>
            </View>
          </View>
          <View
            style={{ flexDirection: "row", gap: spacing.sm }}
            testID="group-create-preview-meta"
          >
            <PreviewMetaCell
              icon={UsersRound}
              label={t("groups.create.preview.members")}
              value={t("groups.create.preview.membersValue")}
            />
            <PreviewMetaCell
              icon={Share2}
              label={t("groups.create.preview.invite")}
              value={t("groups.create.preview.inviteValue")}
            />
          </View>
        </View>

        <View
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderRadius: radii.md,
            borderWidth: 1,
            gap: spacing.lg,
            padding: spacing.lg
          }}
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { onBlur, onChange, value } }) => (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.inkSecondary }} variant="label">
                  {t("groups.create.name.label")}
                </Text>
                <Input
                  accessibilityLabel={t("groups.create.name.label")}
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
                  testID="group-name-input"
                  value={value}
                />
              </View>
            )}
          />

          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.inkSecondary }} variant="label">
              {t("groups.create.template.label")}
            </Text>
            <Controller
              control={control}
              name="template"
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing.sm }}>
                  {GROUP_TEMPLATES.map((template: GroupTemplate) => (
                    <Pressable
                      accessibilityLabel={t(`groups.template.${template}`)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: value === template }}
                      key={template}
                      onPress={() => onChange(template)}
                      style={({ pressed }) => ({
                        backgroundColor: value === template ? colors.tintBrand : colors.bgSurface,
                        borderColor: value === template ? colors.brandPrimary : colors.borderSubtle,
                        borderRadius: radii.md,
                        borderWidth: 1,
                        alignItems: "center",
                        flexDirection: "row",
                        gap: spacing.md,
                        minHeight: 72,
                        opacity: pressed ? 0.72 : 1,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm
                      })}
                    >
                      <GroupTemplateMark size={44} template={template} />
                      <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
                        <Text
                          ellipsizeMode="tail"
                          numberOfLines={1}
                          style={{ color: colors.inkPrimary }}
                          variant="bodyStrong"
                        >
                          {t(`groups.template.${template}`)}
                        </Text>
                        <Text
                          ellipsizeMode="tail"
                          numberOfLines={2}
                          style={{ color: colors.inkMuted }}
                          variant="caption"
                        >
                          {t(`groups.template.${template}.description`)}
                        </Text>
                      </View>
                      <View
                        style={{
                          alignItems: "center",
                          backgroundColor:
                            value === template ? colors.brandPrimary : colors.bgSubtle,
                          borderRadius: radii.pill,
                          height: 28,
                          justifyContent: "center",
                          width: 28
                        }}
                      >
                        {value === template ? (
                          <Check color={colors.inkOnBrand} size={16} strokeWidth={2.4} />
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            />
          </View>

          {createGroup.error ? (
            <Text style={{ color: colors.negative }} variant="caption">
              {t("groups.create.error.generic")}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={{
          backgroundColor: colors.bgCanvas,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          gap: spacing.sm,
          paddingBottom: spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md
        }}
      >
        <View
          accessibilityRole="summary"
          style={{
            alignItems: "center",
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderRadius: radii.md,
            borderWidth: 1,
            flexDirection: "row",
            gap: spacing.sm,
            padding: spacing.sm
          }}
          testID="create-group-footer-summary"
        >
          <GroupTemplateMark size={36} template={previewTemplate} />
          <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
            <Text tone="muted" variant="label">
              {t("groups.create.footer.label")}
            </Text>
            <Text
              ellipsizeMode="tail"
              numberOfLines={1}
              style={{ color: colors.inkPrimary }}
              variant="bodyStrong"
            >
              {previewName}
            </Text>
          </View>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: colors.brandPrimary, maxWidth: 92 }}
            variant="label"
          >
            {t(`groups.template.${previewTemplate}`)}
          </Text>
        </View>
        <Button
          accessibilityLabel={t("groups.create.cta")}
          disabled={createGroup.isPending}
          onPress={onSubmit}
          size="lg"
          testID="create-group-submit"
        >
          {createGroup.isPending ? t("common.loading") : t("groups.create.cta")}
        </Button>
      </View>
    </View>
  );
}

function PreviewMetaCell({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.bgSubtle,
        borderRadius: radii.md,
        flex: 1,
        gap: spacing.xs,
        minWidth: 0,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.xs }}>
        <Icon color={colors.brandPrimary} size={15} />
        <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="label">
          {label}
        </Text>
      </View>
      <Text
        ellipsizeMode="tail"
        numberOfLines={1}
        style={{ color: colors.inkPrimary }}
        variant="caption"
      >
        {value}
      </Text>
    </View>
  );
}
