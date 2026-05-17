import { Plus } from "lucide-react-native";
import { Link, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Avatar, Button, Card, Money, Text, lightColors, spacing } from "@baki/ui";

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: lightColors.bgCanvas, flex: 1 }}
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl }}
    >
      <View style={{ gap: spacing.sm }}>
        <Text variant="display">{t("home.title")}</Text>
        <Text tone="secondary">{t("home.subtitle")}</Text>
      </View>

      <Card style={{ gap: spacing.lg }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
          <Avatar name="Baki" />
          <View style={{ flex: 1 }}>
            <Text variant="h3">{t("home.empty.title")}</Text>
            <Text tone="secondary" variant="caption">
              {t("home.empty.body")}
            </Text>
          </View>
        </View>

        <View
          accessibilityLabel={t("balance.all_settled")}
          style={{
            alignItems: "center",
            backgroundColor: lightColors.bgSubtle,
            borderRadius: 10,
            flexDirection: "row",
            justifyContent: "space-between",
            padding: spacing.lg
          }}
        >
          <Text tone="secondary">{t("balance.all_settled")}</Text>
          <Money amountPaisa={0} />
        </View>

        <Link href={"/phone" as Href} asChild>
          <Button accessibilityLabel={t("groups.create.title")}>
            {`+ ${t("groups.create.title")}`}
          </Button>
        </Link>

        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
          <Plus color={lightColors.brandPrimary} size={18} />
          <Text tone="secondary" variant="caption">
            {t("expense.add.title")}
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}
