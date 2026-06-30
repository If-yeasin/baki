import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useRouter, type Href } from "expo-router";
import { ShieldCheck, Smartphone } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { z } from "zod";

import { Button, Card, PhoneInput, Text, radii, spacing, useTheme } from "@baki/ui";

import { AuthScreenFrame } from "@/components/auth-screen-frame";
import { bdPhoneSchema, displayBdPhone } from "@/features/auth/phone";
import { useRequestOtp } from "@/features/auth/use-phone-auth";

const phoneFormSchema = z.object({
  phone: bdPhoneSchema
});

type PhoneForm = z.input<typeof phoneFormSchema>;

export default function PhoneScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const requestOtp = useRequestOtp();
  const { colors } = useTheme();
  const {
    control,
    formState: { errors },
    handleSubmit
  } = useForm<PhoneForm>({
    defaultValues: { phone: "" },
    resolver: zodResolver(phoneFormSchema)
  });

  const onSubmit = handleSubmit(async ({ phone }) => {
    const result = await requestOtp.mutateAsync({ phone });
    router.push(`/otp?phone=${encodeURIComponent(result.phone)}` as Href);
  });

  return (
    <AuthScreenFrame
      brandLabel={t("common.appName")}
      eyebrow={t("auth.step.phone")}
      icon={Smartphone}
      subtitle={t("auth.phone.subtitle")}
      title={t("auth.phone.title")}
    >
      <Stack.Screen options={{ title: t("auth.phone.title") }} />

      <Card style={{ gap: spacing.lg }}>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onBlur, onChange, value } }) => (
            <PhoneInput
              accessibilityLabel={t("auth.phone.label")}
              errorText={errors.phone?.message ? t(errors.phone.message) : undefined}
              helperText={value ? displayBdPhone(value) : t("auth.phone.helper")}
              label={t("auth.phone.label")}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={t("auth.phone.placeholder")}
              showValidationState
              testID="auth-phone-input"
              value={value}
            />
          )}
        />

        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.bgSubtle,
            borderRadius: radii.md,
            flexDirection: "row",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm
          }}
        >
          <ShieldCheck color={colors.positive} size={18} />
          <Text
            ellipsizeMode="tail"
            numberOfLines={2}
            style={{ color: colors.inkSecondary, flex: 1, minWidth: 0 }}
            variant="caption"
          >
            {t("auth.phone.secure_note")}
          </Text>
        </View>

        {requestOtp.error ? (
          <Text tone="negative" variant="caption">
            {t("auth.error.otp_failed")}
          </Text>
        ) : null}

        <Button disabled={requestOtp.isPending} onPress={onSubmit} size="lg">
          {requestOtp.isPending ? t("common.loading") : t("auth.phone.cta")}
        </Button>
      </Card>
    </AuthScreenFrame>
  );
}
