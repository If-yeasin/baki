import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useRouter, type Href } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { z } from "zod";

import { Input, Text, radii, spacing, useTheme } from "@baki/ui";

import { useCreateGroup } from "@/features/groups/use-create-group";
import { GROUP_TEMPLATES, type GroupTemplate } from "@/features/groups/types";

const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "expense.validation.description_required")
    .max(80, "auth.validation.name_too_long"),
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

  const onSubmit = handleSubmit(async (values) => {
    const group = await createGroup.mutateAsync(values);
    router.replace(`/group/${group.id}` as Href);
  });

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, title: t("groups.create.title") }} />
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.brandPrimary,
          borderBottomColor: colors.brandPrimaryPressed,
          borderBottomWidth: 1,
          flexDirection: "row",
          gap: spacing.md,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing["3xl"]
        }}
      >
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
        <Text style={{ color: colors.inkOnBrand, flex: 1 }} variant="h3">
          {t("groups.create.title")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          gap: spacing.lg,
          padding: spacing.xl,
          paddingBottom: spacing["4xl"]
        }}
        keyboardShouldPersistTaps="handled"
      >
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
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {GROUP_TEMPLATES.map((template: GroupTemplate) => (
                    <Pressable
                      accessibilityLabel={t(`groups.template.${template}`)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: value === template }}
                      key={template}
                      onPress={() => onChange(template)}
                      style={({ pressed }) => ({
                        backgroundColor:
                          value === template ? colors.brandPrimary : colors.bgSurface,
                        borderColor: value === template ? colors.brandPrimary : colors.borderStrong,
                        borderRadius: radii.pill,
                        borderWidth: 1,
                        flexDirection: "row",
                        gap: spacing.xs,
                        minHeight: 42,
                        opacity: pressed ? 0.72 : 1,
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.sm
                      })}
                    >
                      {value === template ? <Check color={colors.inkOnBrand} size={14} /> : null}
                      <Text
                        style={{
                          color: value === template ? colors.inkOnBrand : colors.inkPrimary
                        }}
                        variant="bodyStrong"
                      >
                        {t(`groups.template.${template}`)}
                      </Text>
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

          <Pressable
            accessibilityLabel={t("groups.create.cta")}
            accessibilityRole="button"
            disabled={createGroup.isPending}
            onPress={onSubmit}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: colors.brandPrimary,
              borderRadius: radii.pill,
              justifyContent: "center",
              minHeight: 52,
              opacity: createGroup.isPending ? 0.48 : pressed ? 0.82 : 1
            })}
          >
            <Text style={{ color: colors.inkOnBrand }} variant="bodyStrong">
              {createGroup.isPending ? t("common.loading") : t("groups.create.cta")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
