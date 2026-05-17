import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useRouter, type Href } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { z } from "zod";

import { Button, Card, PhoneInput, Text, lightColors, spacing } from "@baki/ui";

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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: lightColors.bgCanvas, flex: 1 }}
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl }}
    >
      <Stack.Screen options={{ title: t("auth.phone.title") }} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="h1">{t("auth.phone.title")}</Text>
        <Text tone="secondary">{t("auth.phone.subtitle")}</Text>
      </View>

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
              value={value}
            />
          )}
        />

        {requestOtp.error ? (
          <Text tone="negative" variant="caption">
            {t("auth.error.otp_failed")}
          </Text>
        ) : null}

        <Button disabled={requestOtp.isPending} onPress={onSubmit}>
          {requestOtp.isPending ? t("common.loading") : t("auth.phone.cta")}
        </Button>
      </Card>
    </ScrollView>
  );
}
