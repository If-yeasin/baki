import i18next from "i18next";
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle
} from "react-native";

import { typography, type TypographyVariant } from "./theme/typography";
import { useTheme, type ThemeColors } from "./theme/useTheme";

type TextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "positive"
  | "negative"
  | "brand"
  | "onBrand";

export type TextProps = RNTextProps & {
  tone?: TextTone;
  variant?: TypographyVariant;
};

function colorForTone(colors: ThemeColors, tone: TextTone): string {
  switch (tone) {
    case "muted":
      return colors.inkMuted;
    case "negative":
      return colors.negative;
    case "positive":
      return colors.positive;
    case "secondary":
      return colors.inkSecondary;
    case "brand":
      return colors.brandPrimary;
    case "onBrand":
      return colors.inkOnBrand;
    case "primary":
    default:
      return colors.inkPrimary;
  }
}

const bnFontByWeight: Record<string, string> = {
  "400": "HindSiliguri_400Regular",
  "500": "HindSiliguri_500Medium",
  "600": "HindSiliguri_600SemiBold",
  "700": "HindSiliguri_700Bold"
};

const enFontByWeight: Record<string, string> = {
  "400": "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
  "700": "Inter_700Bold"
};

function styleUsesTabularNumerals(style: TextProps["style"]): boolean {
  const flattened = StyleSheet.flatten(style);
  const fontVariant = flattened?.fontVariant;
  return Array.isArray(fontVariant) && fontVariant.includes("tabular-nums");
}

function styleHasExplicitFontFamily(style: TextProps["style"]): boolean {
  const flattened = StyleSheet.flatten(style);
  return typeof flattened?.fontFamily === "string";
}

export function Text({
  children,
  selectable,
  style,
  tone = "primary",
  variant = "body",
  ...props
}: TextProps) {
  const { colors } = useTheme();
  const type = typography[variant];
  const locale = i18next.language?.startsWith("en") ? "en" : "bn";
  const fontWeight =
    locale === "bn" &&
    !styleHasExplicitFontFamily(style) &&
    (variant === "monoAmount" || styleUsesTabularNumerals(style))
      ? "700"
      : type.fontWeight;
  const fontFamily =
    locale === "bn" ? bnFontByWeight[fontWeight] : enFontByWeight[fontWeight];

  const textStyle: TextStyle = {
    color: colorForTone(colors, tone),
    fontFamily,
    fontSize: type.fontSize,
    fontWeight,
    lineHeight: type.lineHeight
  };

  return (
    <RNText selectable={selectable} style={[textStyle, style]} {...props}>
      {children}
    </RNText>
  );
}
