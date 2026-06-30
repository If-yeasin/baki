import {
  BookOpen,
  Bus,
  CalendarDays,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Map,
  ReceiptText,
  ShoppingBag,
  Utensils,
  Zap,
  type LucideIcon
} from "lucide-react-native";
import { View } from "react-native";

import { radii, useTheme } from "@baki/ui";

import type { ExpenseCategory } from "@/features/expenses/types";
import type { GroupTemplate } from "@/features/groups/types";

type MarkPalette = {
  backgroundColor: string;
  foregroundColor: string;
  icon: LucideIcon;
};

type MarkProps = {
  size?: number;
};

export type ExpenseCategoryMarkProps = MarkProps & {
  category: ExpenseCategory;
};

export type GroupTemplateMarkProps = MarkProps & {
  template: GroupTemplate;
};

function Mark({
  backgroundColor,
  foregroundColor,
  icon: Icon,
  radius,
  size
}: MarkPalette & { radius: number; size: number }) {
  return (
    <View
      accessible={false}
      style={{
        alignItems: "center",
        backgroundColor,
        borderRadius: radius,
        height: size,
        justifyContent: "center",
        width: size
      }}
    >
      <Icon color={foregroundColor} size={Math.round(size * 0.46)} strokeWidth={2.2} />
    </View>
  );
}

export function GroupTemplateMark({ size = 48, template }: GroupTemplateMarkProps) {
  const { colors } = useTheme();
  const palette: Record<GroupTemplate, MarkPalette> = {
    custom: {
      backgroundColor: colors.bgSubtle,
      foregroundColor: colors.inkSecondary,
      icon: BookOpen
    },
    event: {
      backgroundColor: colors.tintNegative,
      foregroundColor: colors.negative,
      icon: CalendarDays
    },
    family: {
      backgroundColor: colors.tintInfo,
      foregroundColor: colors.info,
      icon: Home
    },
    mess: {
      backgroundColor: colors.tintBrand,
      foregroundColor: colors.brandPrimary,
      icon: Utensils
    },
    trip: {
      backgroundColor: colors.tintGold,
      foregroundColor: colors.accentGold,
      icon: Map
    }
  };

  return <Mark {...palette[template]} radius={radii.md} size={size} />;
}

export function ExpenseCategoryMark({ category, size = 40 }: ExpenseCategoryMarkProps) {
  const { colors } = useTheme();
  const palette: Record<ExpenseCategory, MarkPalette> = {
    education: {
      backgroundColor: colors.tintInfo,
      foregroundColor: colors.info,
      icon: GraduationCap
    },
    entertainment: {
      backgroundColor: colors.tintNegative,
      foregroundColor: colors.negative,
      icon: Film
    },
    food: {
      backgroundColor: colors.tintBrand,
      foregroundColor: colors.brandPrimary,
      icon: Utensils
    },
    gift: {
      backgroundColor: colors.tintGold,
      foregroundColor: colors.accentGold,
      icon: Gift
    },
    medical: {
      backgroundColor: colors.tintNegative,
      foregroundColor: colors.negative,
      icon: HeartPulse
    },
    other: {
      backgroundColor: colors.bgSubtle,
      foregroundColor: colors.inkSecondary,
      icon: ReceiptText
    },
    rent: {
      backgroundColor: colors.tintInfo,
      foregroundColor: colors.info,
      icon: Home
    },
    shopping: {
      backgroundColor: colors.tintGold,
      foregroundColor: colors.accentGold,
      icon: ShoppingBag
    },
    transport: {
      backgroundColor: colors.tintInfo,
      foregroundColor: colors.info,
      icon: Bus
    },
    utility: {
      backgroundColor: colors.tintWarning,
      foregroundColor: colors.warning,
      icon: Zap
    }
  };

  return <Mark {...palette[category]} radius={radii.sm} size={size} />;
}
