import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import {
  Badge,
  Button,
  Card,
  Chip,
  DatePicker,
  EmptyState,
  Input,
  Money,
  NumericInput,
  PhoneInput,
  Skeleton,
  Tabs,
  Text,
  Toast,
  lightColors,
  spacing
} from "@baki/ui";

type DemoTab = "all" | "pending";

export default function ComponentDemoScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DemoTab>("all");
  const [phone, setPhone] = useState("01712345678");
  const [amount, setAmount] = useState("1250");

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl }}
      style={{ backgroundColor: lightColors.bgCanvas, flex: 1 }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text variant="h1">{t("dev.components.title")}</Text>
        <Text tone="secondary">{t("dev.components.subtitle")}</Text>
      </View>

      <Card style={{ gap: spacing.lg }}>
        <Input
          helperText={t("dev.components.inputHelper")}
          label={t("dev.components.inputLabel")}
          value={t("groups.template.mess")}
        />
        <PhoneInput
          helperText={t("auth.phone.helper")}
          label={t("dev.components.phoneLabel")}
          onChangeText={setPhone}
          showValidationState
          value={phone}
        />
        <NumericInput
          label={t("dev.components.amountLabel")}
          onChangeText={setAmount}
          prefix="৳"
          suffix={t("dev.components.amountSuffix")}
          value={amount}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Tabs
          items={[
            { badge: 3, label: t("dev.components.tabAll"), value: "all" },
            { badge: 1, label: t("dev.components.tabPending"), value: "pending" }
          ]}
          onValueChange={setTab}
          value={tab}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          <Chip selected>{t("groups.template.trip")}</Chip>
          <Chip>{t("groups.template.family")}</Chip>
          <Badge variant="positive">{t("dev.components.badge")}</Badge>
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View
          style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
        >
          <Text variant="bodyStrong">{t("balance.you_are_owed")}</Text>
          <Money amountPaisa={125000} variant="positive" />
        </View>
        <DatePicker
          displayValue="১৮ মে, ২০২৬"
          label={t("dev.components.dateLabel")}
          placeholder={t("dev.components.datePlaceholder")}
        />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button size="sm">{t("dev.components.primaryAction")}</Button>
          <Button size="sm" variant="secondary">
            {t("dev.components.secondaryAction")}
          </Button>
        </View>
      </Card>

      <Toast
        action={{ label: t("sync.action.retry"), onPress: () => undefined }}
        message={t("dev.components.toastBody")}
        title={t("dev.components.toastTitle")}
        variant="info"
      />

      <Card>
        <EmptyState
          action={{ label: t("groups.create.title"), onPress: () => undefined }}
          body={t("dev.components.emptyBody")}
          illustration={<Skeleton animated={false} height={72} variant="circle" width={72} />}
          title={t("dev.components.emptyTitle")}
        />
      </Card>
    </ScrollView>
  );
}
