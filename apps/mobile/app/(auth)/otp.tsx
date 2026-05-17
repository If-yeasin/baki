import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Button, Card, Input, Text, lightColors, spacing } from "@baki/ui";

import { displayBdPhone, otpSchema } from "@/features/auth/phone";
import { useVerifyOtp } from "@/features/auth/use-phone-auth";

export default function OtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = params.phone ?? "";
  const verifyOtp = useVerifyOtp();
  const {
    control,
    formState: { errors },
    handleSubmit
  } = useForm({
    defaultValues: { otp: "", phone },
    resolver: zodResolver(otpSchema)
  });

  const onSubmit = handleSubmit(async ({ otp }) => {
    await verifyOtp.mutateAsync({ otp, phone });
    router.replace(`/profile?phone=${encodeURIComponent(phone)}` as Href);
  });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: lightColors.bgCanvas, flex: 1 }}
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl }}
    >
      <Stack.Screen options={{ title: t("auth.otp.title") }} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="h1">{t("auth.otp.title")}</Text>
        <Text tone="secondary">{t("auth.otp.subtitle")}</Text>
        <Text tone="muted" variant="caption">
          {displayBdPhone(phone)}
        </Text>
      </View>

      <Card style={{ gap: spacing.lg }}>
        <Controller
          control={control}
          name="otp"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input
              accessibilityLabel={t("auth.otp.label")}
              errorText={errors.otp?.message ? t(errors.otp.message) : undefined}
              inputMode="numeric"
              inputStyle={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 24,
                letterSpacing: 0
              }}
              keyboardType="number-pad"
              label={t("auth.otp.label")}
              maxLength={6}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={t("auth.otp.placeholder")}
              value={value}
            />
          )}
        />

        {verifyOtp.error ? (
          <Text tone="negative" variant="caption">
            {t("auth.error.otp_expired")}
          </Text>
        ) : null}

        <Button disabled={verifyOtp.isPending} onPress={onSubmit}>
          {verifyOtp.isPending ? t("common.loading") : t("auth.otp.confirm")}
        </Button>
      </Card>
    </ScrollView>
  );
}
