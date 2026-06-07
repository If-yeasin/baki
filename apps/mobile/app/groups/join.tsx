import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useRouter, type Href } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { z } from "zod";

import { Input, Text, radii, spacing, useTheme } from "@baki/ui";

import { useJoinGroup } from "@/features/groups/use-join-group";

const joinSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "auth.validation.otp_invalid"))
});

type JoinForm = z.input<typeof joinSchema>;

export default function JoinGroupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const joinGroup = useJoinGroup();
  const { colors } = useTheme();
  const {
    control,
    formState: { errors },
    handleSubmit
  } = useForm<JoinForm>({
    defaultValues: { inviteCode: "" },
    resolver: zodResolver(joinSchema)
  });

  const onSubmit = handleSubmit(async ({ inviteCode }) => {
    const result = await joinGroup.mutateAsync({ inviteCode });
    router.replace(`/group/${result.groupId}` as Href);
  });

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, title: t("groups.join.title") }} />
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderSubtle,
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
            backgroundColor: colors.bgSubtle,
            borderRadius: radii.pill,
            height: 40,
            justifyContent: "center",
            opacity: pressed ? 0.72 : 1,
            width: 40
          })}
        >
          <ArrowLeft color={colors.inkPrimary} size={20} />
        </Pressable>
        <Text style={{ color: colors.inkPrimary, flex: 1 }} variant="h3">
          {t("groups.join.title")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl, paddingBottom: spacing["4xl"] }}
        keyboardShouldPersistTaps="handled"
      >
      <View
        style={{
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderStrong,
          borderRadius: radii.xl,
          borderWidth: 1,
          gap: spacing.lg,
          padding: spacing.lg
        }}
      >
        <Controller
          control={control}
          name="inviteCode"
          render={({ field: { onBlur, onChange, value } }) => (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.inkSecondary }} variant="label">
                {t("groups.invite.code.label")}
              </Text>
              <Input
                accessibilityLabel={t("groups.invite.code.label")}
                autoCapitalize="characters"
                errorText={errors.inviteCode?.message ? t(errors.inviteCode.message) : undefined}
                fieldStyle={{
                  backgroundColor: colors.bgSubtle,
                  borderColor: colors.borderStrong,
                  borderRadius: radii.lg,
                  minHeight: 64
                }}
                inputStyle={{
                  color: colors.inkPrimary,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 22,
                  letterSpacing: 4
                }}
                maxLength={6}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder={t("groups.join.code.placeholder")}
                placeholderTextColor={colors.inkMuted}
                value={value}
              />
            </View>
          )}
        />

        {joinGroup.error ? (
          <Text style={{ color: colors.negative }} variant="caption">
            {joinGroup.error instanceof Error && joinGroup.error.message.includes("invite_not_found")
              ? t("groups.join.error.invalid_code")
              : t("groups.join.error.generic")}
          </Text>
        ) : null}

        <Pressable
          accessibilityLabel={t("groups.join.cta")}
          accessibilityRole="button"
          disabled={joinGroup.isPending}
          onPress={onSubmit}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.brandPrimary,
            borderRadius: radii.pill,
            justifyContent: "center",
            minHeight: 52,
            opacity: joinGroup.isPending ? 0.48 : pressed ? 0.82 : 1
          })}
        >
          <Text style={{ color: colors.bgCanvas }} variant="bodyStrong">
            {joinGroup.isPending ? t("common.loading") : t("groups.join.cta")}
          </Text>
        </Pressable>
      </View>
      </ScrollView>
    </View>
  );
}
