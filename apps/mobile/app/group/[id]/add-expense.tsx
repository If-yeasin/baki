import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check, X } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { z } from "zod";

import {
  AmountInput,
  Avatar,
  Input,
  NumericInput,
  Tabs,
  Text,
  radii,
  spacing,
  useTheme
} from "@baki/ui";

import { useSession } from "@/features/auth/use-session";
import { useCreateExpense } from "@/features/expenses/use-create-expense";
import {
  SplitMathError,
  splitExact,
  splitPercent,
  splitShares,
  type SplitMethod
} from "@/features/expenses/split-math";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/features/expenses/types";
import { useGroupDetail } from "@/features/groups/use-group-detail";
import { usePreferencesStore } from "@/stores/preferences";

const SPLIT_METHODS: readonly SplitMethod[] = ["equal", "exact", "percent", "shares"] as const;

const formSchema = z.object({
  amountPaisa: z.number().int().positive("expense.validation.amount_required"),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(1, "expense.validation.description_required").max(120),
  paidBy: z.string().min(1, "auth.error.session_failed"),
  splitMembers: z.array(z.string()).min(1, "expense.validation.members_required"),
  splitMethod: z.enum(["equal", "exact", "percent", "shares"]),
  splitValues: z.record(z.string(), z.number())
});

type FormShape = z.infer<typeof formSchema>;

function mapSplitMathError(code: string): string {
  switch (code) {
    case "shares_must_sum":
      return "expense.validation.shares_required";
    case "percent_must_sum_to_100":
      return "expense.validation.percent_must_sum_100";
    case "members_required":
      return "expense.validation.members_required";
    default:
      return "expense.add.error.generic";
  }
}

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? "";
  const session = useSession();
  const locale = usePreferencesStore((state) => state.locale);
  const { colors } = useTheme();

  const detailQuery = useGroupDetail(groupId);
  const createExpense = useCreateExpense();
  const members = detailQuery.data?.members ?? [];
  const groupName = detailQuery.data?.group.name ?? t("groups.detail.fallback_title");

  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
    watch
  } = useForm<FormShape>({
    defaultValues: {
      amountPaisa: 0,
      category: "food",
      description: "",
      paidBy: session.userId ?? "",
      splitMembers: [],
      splitMethod: "equal",
      splitValues: {}
    },
    resolver: zodResolver(formSchema)
  });

  const splitMembers = watch("splitMembers");
  const paidBy = watch("paidBy");
  const splitMethod = watch("splitMethod");
  const splitValues = watch("splitValues");
  const amountPaisa = watch("amountPaisa");

  const [splitError, setSplitError] = useState<string | null>(null);
  const inputFieldStyle = {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderStrong,
    borderRadius: radii.md
  };
  const inputTextStyle = { color: colors.inkPrimary };

  function toggleMember(userId: string) {
    const current = new Set(splitMembers);
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    setValue("splitMembers", Array.from(current), { shouldValidate: true });
  }

  function updateSplitValue(userId: string, next: number | null) {
    const nextValues: Record<string, number> = { ...splitValues };
    if (next === null || Number.isNaN(next)) {
      delete nextValues[userId];
    } else {
      nextValues[userId] = next;
    }
    setValue("splitValues", nextValues, { shouldValidate: false });
  }

  function buildSplitValuesForMode(
    method: SplitMethod,
    selectedMembers: readonly string[],
    raw: Record<string, number>
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const userId of selectedMembers) {
      const value = raw[userId] ?? 0;
      result[userId] = method === "exact" ? Math.round(value * 100) : value;
    }
    return result;
  }

  function validateSplit(values: FormShape): string | null {
    if (values.splitMethod === "equal") return null;

    const prepared = buildSplitValuesForMode(
      values.splitMethod,
      values.splitMembers,
      values.splitValues ?? {}
    );

    try {
      if (values.splitMethod === "exact") {
        splitExact(values.amountPaisa, prepared);
      } else if (values.splitMethod === "percent") {
        splitPercent(values.amountPaisa, prepared, { payerId: values.paidBy });
      } else if (values.splitMethod === "shares") {
        splitShares(values.amountPaisa, prepared, { payerId: values.paidBy });
      }
      return null;
    } catch (error) {
      if (error instanceof SplitMathError) {
        return mapSplitMathError(error.code);
      }
      return "expense.add.error.generic";
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!groupId) return;

    const splitValidationKey = validateSplit(values);
    if (splitValidationKey) {
      setSplitError(splitValidationKey);
      return;
    }
    setSplitError(null);

    const preparedSplitValues =
      values.splitMethod === "equal"
        ? undefined
        : buildSplitValuesForMode(
            values.splitMethod,
            values.splitMembers,
            values.splitValues ?? {}
          );

    await createExpense.mutateAsync({
      amountPaisa: values.amountPaisa,
      category: values.category,
      description: values.description,
      groupId,
      paidBy: values.paidBy,
      splitMembers: values.splitMembers,
      splitMethod: values.splitMethod,
      splitValues: preparedSplitValues
    });

    router.back();
  });

  return (
    <View style={{ backgroundColor: colors.bgCanvas, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, title: t("expense.add.title") }} />
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
          <X color={colors.inkOnBrand} size={20} />
        </Pressable>
        <Text style={{ color: colors.inkOnBrand, flex: 1 }} variant="h3">
          {t("expense.add.title")}
        </Text>
        <Pressable
          accessibilityLabel={t("expense.add.cta")}
          accessibilityRole="button"
          disabled={createExpense.isPending}
          onPress={onSubmit}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.bgSurface,
            borderRadius: radii.pill,
            flexDirection: "row",
            gap: spacing.xs,
            minHeight: 40,
            opacity: createExpense.isPending ? 0.48 : pressed ? 0.82 : 1,
            paddingHorizontal: spacing.md
          })}
          testID="expense-save-cta"
        >
          <Check color={colors.brandPrimary} size={16} />
          <Text style={{ color: colors.brandPrimary }} variant="label">
            {createExpense.isPending ? t("common.loading") : t("expense.add.cta")}
          </Text>
        </Pressable>
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
            alignSelf: "flex-start",
            backgroundColor: colors.tintBrand,
            borderColor: colors.borderSubtle,
            borderRadius: radii.pill,
            borderWidth: 1,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs
          }}
        >
          <Text style={{ color: colors.brandPrimary }} variant="label">
            {t("expense.add.with_group", { name: groupName })}
          </Text>
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
            name="amountPaisa"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.inkSecondary }} variant="label">
                  {t("expense.amount.label")}
                </Text>
                <AmountInput
                  error={errors.amountPaisa?.message ? t(errors.amountPaisa.message) : undefined}
                  fieldStyle={[inputFieldStyle, { minHeight: 64 }]}
                  inputStyle={[inputTextStyle, { fontSize: 28 }]}
                  locale={locale}
                  onChangePaisa={onChange}
                  placeholderTextColor={colors.inkMuted}
                  testID="amount-input"
                  valuePaisa={value}
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field: { onBlur, onChange, value } }) => (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.inkSecondary }} variant="label">
                  {t("expense.add.description.label")}
                </Text>
                <Input
                  accessibilityLabel={t("expense.add.description.label")}
                  errorText={
                    errors.description?.message ? t(errors.description.message) : undefined
                  }
                  fieldStyle={inputFieldStyle}
                  inputStyle={inputTextStyle}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t("expense.add.description.placeholder")}
                  placeholderTextColor={colors.inkMuted}
                  testID="description-input"
                  value={value}
                />
              </View>
            )}
          />
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={{ color: colors.inkSecondary }} variant="label">
            {t("expense.add.category.label")}
          </Text>
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, value } }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {EXPENSE_CATEGORIES.map((cat: ExpenseCategory) => (
                    <Pressable
                      accessibilityLabel={t(`expense.category.${cat}`)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: value === cat }}
                      key={cat}
                      onPress={() => onChange(cat)}
                      style={({ pressed }) => ({
                        backgroundColor: value === cat ? colors.brandPrimary : colors.bgSurface,
                        borderColor: value === cat ? colors.brandPrimary : colors.borderStrong,
                        borderRadius: radii.pill,
                        borderWidth: 1,
                        minHeight: 40,
                        opacity: pressed ? 0.72 : 1,
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.sm
                      })}
                    >
                      <Text
                        style={{ color: value === cat ? colors.inkOnBrand : colors.inkPrimary }}
                        variant="bodyStrong"
                      >
                        {t(`expense.category.${cat}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          />
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={{ color: colors.inkSecondary }} variant="label">
            {t("expense.add.paidBy.label")}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {members.map((member) => (
                <Pressable
                  accessibilityLabel={member.displayName}
                  accessibilityRole="button"
                  accessibilityState={{ selected: paidBy === member.userId }}
                  key={member.userId}
                  onPress={() => setValue("paidBy", member.userId, { shouldValidate: true })}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: paidBy === member.userId ? colors.bgSubtle : colors.bgSurface,
                    borderColor:
                      paidBy === member.userId ? colors.brandPrimary : colors.borderStrong,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: spacing.sm,
                    minHeight: 44,
                    opacity: pressed ? 0.72 : 1,
                    paddingHorizontal: spacing.md
                  })}
                >
                  <Avatar name={member.displayName} size="sm" />
                  <Text style={{ color: colors.inkPrimary }} variant="bodyStrong">
                    {member.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderRadius: radii.md,
            borderWidth: 1,
            gap: spacing.md,
            padding: spacing.lg
          }}
        >
          <Text style={{ color: colors.inkSecondary }} variant="label">
            {t("expense.add.splitMethod.label")}
          </Text>
          <Controller
            control={control}
            name="splitMethod"
            render={({ field: { onChange, value } }) => (
              <Tabs
                items={SPLIT_METHODS.map((method) => ({
                  label: t(`expense.add.splitMethod.${method}`),
                  value: method
                }))}
                onValueChange={(next) => onChange(next as SplitMethod)}
                style={{ backgroundColor: colors.bgSubtle }}
                tabStyle={{ borderColor: "transparent" }}
                value={value}
              />
            )}
          />

          <Text style={{ color: colors.inkSecondary }} variant="label">
            {t("expense.add.splitWith.label")}
          </Text>
          <View style={{ gap: spacing.sm }}>
            {members.map((member) => {
              const selected = splitMembers.includes(member.userId);
              return (
                <Pressable
                  accessibilityLabel={member.displayName}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={member.userId}
                  onPress={() => toggleMember(member.userId)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: selected ? colors.tintBrand : colors.bgSurface,
                    borderColor: selected ? colors.brandPrimary : colors.borderSubtle,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: spacing.md,
                    minHeight: 56,
                    opacity: pressed ? 0.78 : 1,
                    paddingHorizontal: spacing.md
                  })}
                >
                  <Avatar name={member.displayName} size="md" />
                  <Text
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={{ color: colors.inkPrimary, flex: 1 }}
                    variant="bodyStrong"
                  >
                    {member.displayName}
                  </Text>
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: selected ? colors.brandPrimary : "transparent",
                      borderColor: selected ? colors.brandPrimary : colors.borderStrong,
                      borderRadius: radii.pill,
                      borderWidth: 1.5,
                      height: 24,
                      justifyContent: "center",
                      width: 24
                    }}
                  >
                    {selected ? <Check color={colors.inkOnBrand} size={14} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {errors.splitMembers?.message ? (
            <Text style={{ color: colors.negative }} variant="caption">
              {t(errors.splitMembers.message)}
            </Text>
          ) : null}

          {splitMethod !== "equal" ? (
            <View style={{ gap: spacing.sm }}>
              {members
                .filter((member) => splitMembers.includes(member.userId))
                .map((member) => {
                  const rawValue = splitValues?.[member.userId];
                  const stringValue =
                    rawValue === undefined || rawValue === null ? "" : String(rawValue);
                  const suffix =
                    splitMethod === "percent"
                      ? "%"
                      : splitMethod === "shares"
                        ? t("expense.add.splitMethod.shares")
                        : undefined;
                  return (
                    <NumericInput
                      accessibilityLabel={member.displayName}
                      allowDecimal={splitMethod !== "shares"}
                      fieldStyle={inputFieldStyle}
                      inputStyle={inputTextStyle}
                      key={member.userId}
                      label={member.displayName}
                      onNumericValueChange={(next) => updateSplitValue(member.userId, next)}
                      placeholderTextColor={colors.inkMuted}
                      prefix={splitMethod === "exact" ? "৳" : undefined}
                      suffix={suffix}
                      value={stringValue}
                    />
                  );
                })}
              {splitMethod === "exact" && amountPaisa > 0 ? (
                <Text style={{ color: colors.inkMuted }} variant="caption">
                  ৳{(amountPaisa / 100).toFixed(2)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {splitError ? (
            <Text style={{ color: colors.negative }} variant="caption">
              {t(splitError)}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            borderRadius: radii.lg,
            borderWidth: 1,
            flexDirection: "row",
            gap: spacing.md,
            padding: spacing.lg
          }}
        >
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ color: colors.inkMuted }} variant="label">
              {t("expense.add.paidBy.label")}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.inkPrimary }} variant="bodyStrong">
              {members.find((member) => member.userId === paidBy)?.displayName ??
                t("common.unknown_user")}
            </Text>
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ color: colors.inkMuted }} variant="label">
              {t("expense.add.splitMethod.label")}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.inkPrimary }} variant="bodyStrong">
              {t(`expense.add.splitMethod.${splitMethod}`)}
            </Text>
          </View>
        </View>

        {createExpense.error ? (
          <Text style={{ color: colors.negative }} variant="caption">
            {t("expense.add.error.generic")}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
