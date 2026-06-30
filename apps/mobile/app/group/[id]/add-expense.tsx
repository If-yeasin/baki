import { zodResolver } from "@hookform/resolvers/zod";
import { formatMoney, toBengaliNumerals } from "@baki/i18n";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
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

import { ExpenseReviewCard } from "@/components/expense-review-card";
import { ExpenseCategoryMark } from "@/components/ledger-marks";
import { useSession } from "@/features/auth/use-session";
import { useCreateExpense } from "@/features/expenses/use-create-expense";
import {
  SplitMathError,
  splitEqual,
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

function formatMemberCount(count: number, locale: "bn" | "en"): string {
  return locale === "bn" ? toBengaliNumerals(count) : String(count);
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
    getValues,
    handleSubmit,
    reset,
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
  const description = watch("description");

  const memberIds = useMemo(() => members.map((member) => member.userId), [members]);
  const defaultPayerId = useMemo(() => {
    const sessionUserId = session.userId ?? "";
    return memberIds.includes(sessionUserId) ? sessionUserId : (memberIds[0] ?? "");
  }, [memberIds, session.userId]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitMembersTouched, setSplitMembersTouched] = useState(false);
  const initializedSplitMembers = useRef(false);
  const selectedSplitMembers = splitMembersTouched ? splitMembers : memberIds;
  const selectedPaidBy = paidBy || defaultPayerId;
  const selectedCategory = watch("category");
  const selectedPayerName =
    members.find((member) => member.userId === selectedPaidBy)?.displayName ??
    t("common.unknown_user");
  const splitMemberCount = selectedSplitMembers.length;
  const quickPreview = useMemo(() => {
    const countLabel = formatMemberCount(splitMemberCount, locale);
    const splitCountLabel = t("expense.review.splitWithCount", { count: countLabel });
    const methodLabel = t(`expense.add.splitMethod.${splitMethod}`);
    const readyForEqualPreview =
      amountPaisa > 0 && splitMemberCount > 0 && splitMethod === "equal";
    const equalShare = readyForEqualPreview
      ? splitEqual(amountPaisa, selectedSplitMembers, { payerId: selectedPaidBy })[
          selectedSplitMembers[0] ?? ""
        ] ?? 0
      : 0;

    return {
      amountLabel: readyForEqualPreview
        ? formatMoney(equalShare, locale)
        : amountPaisa > 0
          ? t("expense.quickPreview.customValue")
          : t("expense.quickPreview.waitingValue"),
      amountTone: readyForEqualPreview ? ("brand" as const) : ("muted" as const),
      payerLine: t("expense.quickPreview.paidBy", { name: selectedPayerName }),
      splitLine: t("expense.quickPreview.splitLine", {
        count: splitCountLabel,
        method: methodLabel
      }),
      valueLabel: readyForEqualPreview
        ? t("expense.quickPreview.perPerson")
        : t("expense.quickPreview.valueLabel")
    };
  }, [
    amountPaisa,
    locale,
    selectedPaidBy,
    selectedPayerName,
    selectedSplitMembers,
    splitMemberCount,
    splitMethod,
    t
  ]);
  const splitPreview = useMemo(() => {
    if (splitMemberCount === 0) {
      return {
        body: t("expense.splitPreview.noMembers.body"),
        title: t("expense.splitPreview.noMembers.title")
      };
    }

    const countLabel = formatMemberCount(splitMemberCount, locale);

    if (amountPaisa <= 0) {
      return {
        body: t("expense.splitPreview.waiting.body"),
        title: t("expense.splitPreview.waiting.title", { count: countLabel })
      };
    }

    if (splitMethod === "equal") {
      const equalShares = splitEqual(amountPaisa, selectedSplitMembers, {
        payerId: selectedPaidBy
      });
      const firstShare = equalShares[selectedSplitMembers[0] ?? ""] ?? 0;

      return {
        body: t("expense.splitPreview.equal.body", {
          amount: formatMoney(firstShare, locale)
        }),
        title: t("expense.splitPreview.equal.title", { count: countLabel })
      };
    }

    const bodyKey =
      splitMethod === "exact"
        ? "expense.splitPreview.exact.body"
        : splitMethod === "percent"
          ? "expense.splitPreview.percent.body"
          : "expense.splitPreview.shares.body";

    return {
      body: t(bodyKey),
      title: t("expense.splitPreview.custom.title", { count: countLabel })
    };
  }, [amountPaisa, locale, selectedPaidBy, selectedSplitMembers, splitMemberCount, splitMethod, t]);
  const reviewStatusKey =
    amountPaisa > 0 && description.trim().length > 0
      ? "expense.review.status.ready"
      : "expense.review.status.draft";
  const inputFieldStyle = {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderStrong,
    borderRadius: radii.md
  };
  const inputTextStyle = { color: colors.inkPrimary };

  useEffect(() => {
    if (initializedSplitMembers.current || members.length === 0) return;

    const currentValues = getValues();
    const currentPaidBy = currentValues.paidBy;

    reset({
      ...currentValues,
      paidBy: currentPaidBy && memberIds.includes(currentPaidBy) ? currentPaidBy : defaultPayerId,
      splitMembers: memberIds
    });
    initializedSplitMembers.current = true;
  }, [defaultPayerId, getValues, memberIds, members.length, reset]);

  function toggleMember(userId: string) {
    const current = new Set(selectedSplitMembers);
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    setSplitMembersTouched(true);
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

    const submissionValues = {
      ...values,
      paidBy: values.paidBy || defaultPayerId,
      splitMembers: splitMembersTouched ? values.splitMembers : memberIds
    };

    const splitValidationKey = validateSplit(submissionValues);
    if (splitValidationKey) {
      setSplitError(splitValidationKey);
      return;
    }
    setSplitError(null);

    const preparedSplitValues =
      submissionValues.splitMethod === "equal"
        ? undefined
        : buildSplitValuesForMode(
            submissionValues.splitMethod,
            submissionValues.splitMembers,
            submissionValues.splitValues ?? {}
          );

    await createExpense.mutateAsync({
      amountPaisa: submissionValues.amountPaisa,
      category: submissionValues.category,
      description: submissionValues.description,
      groupId,
      paidBy: submissionValues.paidBy,
      splitMembers: submissionValues.splitMembers,
      splitMethod: submissionValues.splitMethod,
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
                  placeholder={t("expense.amount.placeholder")}
                  placeholderTextColor={colors.inkMuted}
                  showZeroValue={false}
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

        <ExpenseQuickPreview
          amountLabel={quickPreview.amountLabel}
          amountTone={quickPreview.amountTone}
          category={selectedCategory}
          payerLine={quickPreview.payerLine}
          splitLine={quickPreview.splitLine}
          title={t("expense.quickPreview.title")}
          valueLabel={quickPreview.valueLabel}
        />

        <View style={{ gap: spacing.md }}>
          <Text style={{ color: colors.inkSecondary }} variant="label">
            {t("expense.add.category.label")}
          </Text>
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, value } }) => (
              <ScrollView
                contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.xl }}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {EXPENSE_CATEGORIES.map((cat: ExpenseCategory) => (
                  <CategoryTile
                    category={cat}
                    key={cat}
                    label={t(`expense.category.${cat}`)}
                    onPress={() => onChange(cat)}
                    selected={value === cat}
                  />
                ))}
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
                  accessibilityState={{ selected: selectedPaidBy === member.userId }}
                  key={member.userId}
                  onPress={() => setValue("paidBy", member.userId, { shouldValidate: true })}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor:
                      selectedPaidBy === member.userId ? colors.bgSubtle : colors.bgSurface,
                    borderColor:
                      selectedPaidBy === member.userId ? colors.brandPrimary : colors.borderStrong,
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

          <View
            accessibilityRole="summary"
            style={{
              backgroundColor: colors.bgSubtle,
              borderRadius: radii.md,
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm
            }}
            testID="expense-split-preview"
          >
            <Text tone="muted" variant="label">
              {t("expense.splitPreview.title")}
            </Text>
            <Text variant="bodyStrong">{splitPreview.title}</Text>
            <Text tone="secondary" variant="caption">
              {splitPreview.body}
            </Text>
          </View>

          <Text style={{ color: colors.inkSecondary }} variant="label">
            {t("expense.add.splitWith.label")}
          </Text>
          <View style={{ gap: spacing.sm }}>
            {members.map((member) => {
              const selected = selectedSplitMembers.includes(member.userId);
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
                .filter((member) => selectedSplitMembers.includes(member.userId))
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
                  {formatMoney(amountPaisa, locale)}
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

        <ExpenseReviewCard
          amountLabel={formatMoney(amountPaisa, locale)}
          categoryLabel={t("expense.review.category")}
          categoryValue={t(`expense.category.${selectedCategory}`)}
          methodLabel={t("expense.review.method")}
          methodValue={t(`expense.add.splitMethod.${splitMethod}`)}
          payerLabel={t("expense.review.payer")}
          payerValue={selectedPayerName}
          splitWithLabel={t("expense.review.splitWith")}
          splitWithValue={t("expense.review.splitWithCount", {
            count: formatMemberCount(splitMemberCount, locale)
          })}
          statusLabel={t(reviewStatusKey)}
          title={t("expense.review.title")}
          totalLabel={t("expense.review.total")}
        />

        {createExpense.error ? (
          <Text style={{ color: colors.negative }} variant="caption">
            {t("expense.add.error.generic")}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function CategoryTile({
  category,
  label,
  onPress,
  selected
}: {
  category: ExpenseCategory;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: selected ? colors.tintBrand : colors.bgSurface,
        borderColor: selected ? colors.brandPrimary : colors.borderSubtle,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing.xs,
        justifyContent: "center",
        minHeight: 76,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        width: 80
      })}
    >
      <ExpenseCategoryMark category={category} size={34} />
      <Text
        adjustsFontSizeToFit
        ellipsizeMode="tail"
        minimumFontScale={0.76}
        numberOfLines={1}
        style={{
          color: selected ? colors.brandPrimary : colors.inkPrimary,
          textAlign: "center",
          width: "100%"
        }}
        variant="label"
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ExpenseQuickPreview({
  amountLabel,
  amountTone,
  category,
  payerLine,
  splitLine,
  title,
  valueLabel
}: {
  amountLabel: string;
  amountTone: "brand" | "muted";
  category: ExpenseCategory;
  payerLine: string;
  splitLine: string;
  title: string;
  valueLabel: string;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.bgSurface,
        borderColor: colors.borderSubtle,
        borderRadius: radii.md,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 76,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm
      }}
      testID="expense-quick-preview"
    >
      <ExpenseCategoryMark category={category} size={38} />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={{ color: colors.inkPrimary }} variant="bodyStrong">
          {title}
        </Text>
        <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="caption">
          {payerLine}
        </Text>
        <Text ellipsizeMode="tail" numberOfLines={1} tone="secondary" variant="caption">
          {splitLine}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", flexShrink: 0, gap: 2, maxWidth: 128 }}>
        <Text tone="muted" variant="label">
          {valueLabel}
        </Text>
        <Text
          accessibilityLabel={amountLabel}
          adjustsFontSizeToFit
          minimumFontScale={0.74}
          numberOfLines={1}
          style={{ fontVariant: ["tabular-nums"], textAlign: "right" }}
          tone={amountTone}
          variant="bodyStrong"
        >
          {amountLabel}
        </Text>
      </View>
    </View>
  );
}
