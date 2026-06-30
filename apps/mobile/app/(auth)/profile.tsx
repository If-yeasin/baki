import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { UserRound } from "lucide-react-native";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar, Button, Card, Input, Text, radii, spacing, useTheme } from "@baki/ui";

import { AuthScreenFrame } from "@/components/auth-screen-frame";
import { displayBdPhone, profileSchema } from "@/features/auth/phone";
import { useUpsertProfile } from "@/features/auth/use-phone-auth";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = params.phone ?? "";
  const upsertProfile = useUpsertProfile();
  const { colors } = useTheme();
  const {
    control,
    formState: { errors },
    handleSubmit
  } = useForm({
    defaultValues: { displayName: "", phone },
    resolver: zodResolver(profileSchema)
  });
  const watchedName = useWatch({ control, name: "displayName" });
  const previewName = watchedName.trim() || t("auth.profile.name.placeholder");

  const onSubmit = handleSubmit(async ({ displayName }) => {
    await upsertProfile.mutateAsync({ displayName, phone });
    router.replace("/");
  });

  return (
    <AuthScreenFrame
      backLabel={t("common.cancel")}
      brandLabel={t("common.appName")}
      eyebrow={t("auth.step.profile")}
      icon={UserRound}
      onBack={() => router.back()}
      subtitle={t("auth.profile.subtitle")}
      title={t("auth.profile.title")}
    >
      <Stack.Screen options={{ title: t("auth.profile.title") }} />

      <Card style={{ gap: spacing.lg }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.bgSubtle,
            borderRadius: radii.md,
            flexDirection: "row",
            gap: spacing.md,
            padding: spacing.md
          }}
        >
          <Avatar name={previewName} size="lg" />
          <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
            <Text style={{ color: colors.inkMuted }} variant="label">
              {t("auth.profile.preview.label")}
            </Text>
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
              style={{ color: colors.inkMuted, fontVariant: ["tabular-nums"] }}
              variant="caption"
            >
              {displayBdPhone(phone)}
            </Text>
          </View>
        </View>

        <Controller
          control={control}
          name="displayName"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input
              accessibilityLabel={t("auth.profile.name.label")}
              autoCapitalize="words"
              errorText={errors.displayName?.message ? t(errors.displayName.message) : undefined}
              inputStyle={{ fontFamily: "HindSiliguri_500Medium", fontSize: 17 }}
              label={t("auth.profile.name.label")}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={t("auth.profile.name.placeholder")}
              testID="auth-profile-name-input"
              value={value}
            />
          )}
        />

        <Text style={{ color: colors.inkMuted }} variant="caption">
          {t("auth.profile.helper")}
        </Text>

        {upsertProfile.error ? (
          <Text tone="negative" variant="caption">
            {t("auth.error.profile_failed")}
          </Text>
        ) : null}

        <Button disabled={upsertProfile.isPending} onPress={onSubmit} size="lg">
          {upsertProfile.isPending ? t("common.loading") : t("auth.profile.continue")}
        </Button>
      </Card>
    </AuthScreenFrame>
  );
}
