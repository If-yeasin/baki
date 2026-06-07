import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Button, Card, Input, Text, spacing, useTheme } from "@baki/ui";

import { profileSchema } from "@/features/auth/phone";
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

  const onSubmit = handleSubmit(async ({ displayName }) => {
    await upsertProfile.mutateAsync({ displayName, phone });
    router.replace("/");
  });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.bgCanvas, flex: 1 }}
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl }}
    >
      <Stack.Screen options={{ title: t("auth.profile.title") }} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="h1">{t("auth.profile.title")}</Text>
        <Text tone="secondary">{t("auth.profile.subtitle")}</Text>
      </View>

      <Card style={{ gap: spacing.lg }}>
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
              value={value}
            />
          )}
        />

        {upsertProfile.error ? (
          <Text tone="negative" variant="caption">
            {t("auth.error.profile_failed")}
          </Text>
        ) : null}

        <Button disabled={upsertProfile.isPending} onPress={onSubmit}>
          {upsertProfile.isPending ? t("common.loading") : t("auth.profile.continue")}
        </Button>
      </Card>
    </ScrollView>
  );
}
