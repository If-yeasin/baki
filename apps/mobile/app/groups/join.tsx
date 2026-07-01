import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useRouter, type Href } from "expo-router";
import { ArrowLeft, CheckCircle2, Hash, ShieldCheck } from "lucide-react-native";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { z } from "zod";

import { Button, Input, Text, radii, spacing, useTheme } from "@baki/ui";

import { useJoinGroup } from "@/features/groups/use-join-group";

const joinSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "groups.validation.invite_code_invalid"))
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
  const watchedInviteCode = useWatch({ control, name: "inviteCode" });
  const normalizedInviteCode = watchedInviteCode.trim().toUpperCase();
  const inviteCodeIsReady = /^[A-Z0-9]{6}$/.test(normalizedInviteCode);

  const onSubmit = handleSubmit(async ({ inviteCode }) => {
    const result = await joinGroup.mutateAsync({ inviteCode });
    router.replace(`/group/${result.groupId}` as Href);
  });

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, title: t("groups.join.title") }} />
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
            {t("groups.join.title")}
          </Text>
        </View>
        <Text style={{ color: colors.inkOnBrand, opacity: 0.88 }} variant="body">
          {t("groups.join.subtitle")}
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
        <View
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderStrong,
            borderRadius: radii.md,
            borderWidth: 1,
            gap: spacing.lg,
            padding: spacing.lg
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: colors.tintBrand,
                borderRadius: radii.md,
                height: 52,
                justifyContent: "center",
                width: 52
              }}
            >
              <Hash color={colors.brandPrimary} size={24} />
            </View>
            <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={{ color: colors.inkPrimary }}
                variant="bodyStrong"
              >
                {t("groups.join.card.title")}
              </Text>
              <Text
                ellipsizeMode="tail"
                numberOfLines={2}
                style={{ color: colors.inkMuted }}
                variant="caption"
              >
                {t("groups.join.card.body")}
              </Text>
            </View>
          </View>

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
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderStrong,
                    borderRadius: radii.md,
                    minHeight: 64,
                    paddingHorizontal: spacing.md
                  }}
                  inputStyle={{
                    color: colors.inkPrimary,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 22,
                    fontVariant: ["tabular-nums"],
                    letterSpacing: 0,
                    textAlign: "center",
                    textTransform: "uppercase"
                  }}
                  maxLength={6}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t("groups.join.code.placeholder")}
                  placeholderTextColor={colors.inkMuted}
                  testID="join-code-input"
                  value={value}
                />
              </View>
            )}
          />

          <InviteCodePreview
            code={normalizedInviteCode}
            isReady={inviteCodeIsReady}
            label={t("groups.join.code.previewLabel")}
          />

          <View
            style={{
              alignItems: "center",
              backgroundColor: inviteCodeIsReady ? colors.tintBrand : colors.bgSubtle,
              borderColor: inviteCodeIsReady ? colors.brandPrimary : colors.borderSubtle,
              borderRadius: radii.md,
              borderWidth: 1,
              flexDirection: "row",
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm
            }}
            testID="join-code-status"
          >
            <CheckCircle2
              color={inviteCodeIsReady ? colors.brandPrimary : colors.inkMuted}
              size={18}
            />
            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={{ color: inviteCodeIsReady ? colors.brandPrimary : colors.inkSecondary }}
                variant="label"
              >
                {inviteCodeIsReady ? t("groups.join.code.ready") : t("groups.join.code.waiting")}
              </Text>
              <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="caption">
                {inviteCodeIsReady
                  ? t("groups.join.code.readyBody")
                  : t("groups.join.code.waitingBody")}
              </Text>
            </View>
          </View>

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
              {t("groups.join.helper")}
            </Text>
          </View>

          {joinGroup.error ? (
            <Text style={{ color: colors.negative }} variant="caption">
              {joinGroup.error instanceof Error &&
              joinGroup.error.message.includes("invite_not_found")
                ? t("groups.join.error.invalid_code")
                : t("groups.join.error.generic")}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={{
          backgroundColor: colors.bgCanvas,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          paddingBottom: spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md
        }}
      >
        <Button
          accessibilityLabel={t("groups.join.cta")}
          disabled={joinGroup.isPending}
          onPress={onSubmit}
          size="lg"
          testID="join-group-submit"
        >
          {joinGroup.isPending ? t("common.loading") : t("groups.join.cta")}
        </Button>
      </View>
    </View>
  );
}

function InviteCodePreview({
  code,
  isReady,
  label
}: {
  code: string;
  isReady: boolean;
  label: string;
}) {
  const { colors } = useTheme();
  const cells = Array.from({ length: 6 }, (_, index) => code[index] ?? "");

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="summary"
      style={{
        flexDirection: "row",
        gap: spacing.xs
      }}
      testID="join-code-preview"
    >
      {cells.map((character, index) => {
        const filled = character.length > 0;
        return (
          <View
            key={`${index}-${character || "empty"}`}
            style={{
              alignItems: "center",
              backgroundColor: filled ? colors.tintBrand : colors.bgSubtle,
              borderColor: isReady
                ? colors.brandPrimary
                : filled
                  ? colors.brandPrimaryPressed
                  : colors.borderSubtle,
              borderRadius: radii.md,
              borderWidth: 1,
              flex: 1,
              height: 46,
              justifyContent: "center",
              minWidth: 0
            }}
          >
            <Text
              ellipsizeMode="clip"
              numberOfLines={1}
              style={{
                color: filled ? colors.brandPrimary : colors.inkMuted,
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                fontVariant: ["tabular-nums"],
                textAlign: "center"
              }}
              variant="bodyStrong"
            >
              {character}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
