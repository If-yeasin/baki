import type { ExpenseCategory } from "@/features/expenses/types";
import { HandCoins, NotebookPen, ReceiptText, UserRound } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text, radii, spacing, useTheme } from "@baki/ui";

import { ExpenseCategoryMark } from "./ledger-marks";

export type ActivityFeedItem = {
  amountAccessibilityLabel?: string;
  amountLabel?: string;
  category?: ExpenseCategory;
  categoryLabel?: string;
  description: string;
  eventLabel: string;
  groupName: string;
  id: string;
  leadingTone?: "expense" | "group" | "member" | "settlement";
  onPress: () => void;
  payerLabel: string;
  paidBySelf: boolean;
};

export type ActivityFeedSection = {
  countLabel: string;
  id: string;
  items: ActivityFeedItem[];
  title: string;
};

type ActivityFeedListProps = {
  sections: ActivityFeedSection[];
};

export function ActivityFeedList({ sections }: ActivityFeedListProps) {
  const { colors } = useTheme();

  const renderLeading = (item: ActivityFeedItem) => {
    if (item.category) {
      return <ExpenseCategoryMark category={item.category} />;
    }

    const Icon =
      item.leadingTone === "settlement"
        ? HandCoins
        : item.leadingTone === "member"
          ? UserRound
          : item.leadingTone === "group"
            ? NotebookPen
            : ReceiptText;

    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.bgSubtle,
          borderRadius: radii.pill,
          height: 36,
          justifyContent: "center",
          width: 36
        }}
      >
        <Icon color={colors.brandPrimary} size={18} />
      </View>
    );
  };

  return (
    <View style={{ gap: spacing.lg }} testID="activity-feed-list">
      {sections.map((section) => (
        <View key={section.id} style={{ gap: spacing.sm }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
            <Text style={{ color: colors.inkSecondary, flex: 1 }} variant="label">
              {section.title}
            </Text>
            <View
              style={{
                backgroundColor: colors.bgSubtle,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs
              }}
            >
              <Text tone="muted" variant="label">
                {section.countLabel}
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              borderWidth: 1,
              overflow: "hidden"
            }}
          >
            {section.items.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={item.onPress}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: pressed ? colors.bgSubtle : colors.bgSurface,
                  borderBottomColor: colors.rowDivider,
                  borderBottomWidth: index === section.items.length - 1 ? 0 : 1,
                  flexDirection: "row",
                  gap: spacing.md,
                  minHeight: 82,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm
                })}
              >
                {renderLeading(item)}
                <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.xs }}>
                    <Text
                      ellipsizeMode="tail"
                      numberOfLines={1}
                      style={{ color: colors.inkPrimary, flex: 1, minWidth: 0 }}
                      variant="bodyStrong"
                    >
                      {item.description}
                    </Text>
                    <View
                      style={{
                        backgroundColor: item.paidBySelf ? colors.tintPositive : colors.bgSubtle,
                        borderRadius: radii.pill,
                        flexShrink: 0,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2
                      }}
                    >
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        style={{
                          color: item.paidBySelf ? colors.positive : colors.inkMuted,
                          maxWidth: 96
                        }}
                        variant="label"
                      >
                        {item.payerLabel}
                      </Text>
                    </View>
                  </View>
                  <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="caption">
                    {item.categoryLabel
                      ? `${item.groupName} · ${item.categoryLabel}`
                      : item.groupName}
                  </Text>
                  <Text ellipsizeMode="tail" numberOfLines={1} tone="muted" variant="caption">
                    {item.eventLabel}
                  </Text>
                </View>
                {item.amountLabel ? (
                  <Text
                    accessibilityLabel={item.amountAccessibilityLabel}
                    adjustsFontSizeToFit
                    minimumFontScale={0.76}
                    numberOfLines={1}
                    style={{
                      color: colors.inkPrimary,
                      fontVariant: ["tabular-nums"],
                      maxWidth: 112,
                      textAlign: "right"
                    }}
                    variant="bodyStrong"
                  >
                    {item.amountLabel}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
