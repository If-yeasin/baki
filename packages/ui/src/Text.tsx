import i18next from "i18next";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { lightColors } from "./theme/tokens";
import { typography, type TypographyVariant } from "./theme/typography";

type TextTone = "primary" | "secondary" | "muted" | "positive" | "negative";

export type TextProps = RNTextProps & {
  tone?: TextTone;
  variant?: TypographyVariant;
};

const toneColor: Record<TextTone, string> = {
  muted: lightColors.inkMuted,
  negative: lightColors.negative,
  positive: lightColors.positive,
  primary: lightColors.inkPrimary,
  secondary: lightColors.inkSecondary
};

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

export function Text({
  children,
  selectable,
  style,
  tone = "primary",
  variant = "body",
  ...props
}: TextProps) {
  const type = typography[variant];
  const locale = i18next.language?.startsWith("en") ? "en" : "bn";
  const fontFamily =
    locale === "bn" ? bnFontByWeight[type.fontWeight] : enFontByWeight[type.fontWeight];

  const textStyle: TextStyle = {
    color: toneColor[tone],
    fontFamily,
    fontSize: type.fontSize,
    fontWeight: type.fontWeight,
    lineHeight: type.lineHeight
  };

  return (
    <RNText selectable={selectable} style={[textStyle, style]} {...props}>
      {children}
    </RNText>
  );
}
