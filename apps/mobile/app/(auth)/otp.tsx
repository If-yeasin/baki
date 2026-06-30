import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { KeyRound } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button, Card, Input, Text, radii, spacing, useTheme } from "@baki/ui";

import { AuthScreenFrame } from "@/components/auth-screen-frame";
import { displayBdPhone, otpSchema } from "@/features/auth/phone";
import { useVerifyOtp } from "@/features/auth/use-phone-auth";

export default function OtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = params.phone ?? "";
  const verifyOtp = useVerifyOtp();
  const { colors } = useTheme();
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
    <AuthScreenFrame
      backLabel={t("common.cancel")}
      brandLabel={t("common.appName")}
      eyebrow={t("auth.step.otp")}
      icon={KeyRound}
      onBack={() => router.back()}
      subtitle={t("auth.otp.subtitle")}
      title={t("auth.otp.title")}
    >
      <Stack.Screen options={{ title: t("auth.otp.title") }} />

      <Card style={{ gap: spacing.lg }}>
        <View
          style={{
            backgroundColor: colors.bgSubtle,
            borderRadius: radii.md,
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm
          }}
        >
          <Text style={{ color: colors.inkMuted }} variant="label">
            {t("auth.otp.sent_to")}
          </Text>
          <Text
            selectable
            style={{ color: colors.inkPrimary, fontVariant: ["tabular-nums"] }}
            variant="bodyStrong"
          >
            {displayBdPhone(phone)}
          </Text>
        </View>

        <Controller
          control={control}
          name="otp"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input
              accessibilityLabel={t("auth.otp.label")}
              errorText={errors.otp?.message ? t(errors.otp.message) : undefined}
              inputMode="numeric"
              fieldStyle={{ minHeight: 64 }}
              inputStyle={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 24,
                fontVariant: ["tabular-nums"],
                letterSpacing: 0,
                textAlign: "center"
              }}
              keyboardType="number-pad"
              label={t("auth.otp.label")}
              maxLength={6}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={t("auth.otp.placeholder")}
              testID="auth-otp-input"
              value={value}
            />
          )}
        />

        <Text style={{ color: colors.inkMuted }} variant="caption">
          {t("auth.otp.helper")}
        </Text>

        {verifyOtp.error ? (
          <Text tone="negative" variant="caption">
            {t("auth.error.otp_expired")}
          </Text>
        ) : null}

        <Button disabled={verifyOtp.isPending} onPress={onSubmit} size="lg">
          {verifyOtp.isPending ? t("common.loading") : t("auth.otp.confirm")}
        </Button>
      </Card>
    </AuthScreenFrame>
  );
}
