export const lightColors = {
  bgCanvas: "#f7fbfa",
  bgSurface: "#ffffff",
  bgSubtle: "#edf5f2",
  // Tinted surfaces used for soft state backgrounds (badges, pills).
  tintBrand: "#dcf7ef",
  tintPositive: "#dcf7ef",
  tintNegative: "#fff0ec",
  tintWarning: "#ffedd5",
  tintInfo: "#e0f2fe",
  tintGold: "#fff5d8",
  inkPrimary: "#172321",
  inkSecondary: "#53615f",
  inkMuted: "#8a9693",
  // Foreground used on filled brand/destructive backgrounds.
  inkOnBrand: "#ffffff",
  brandPrimary: "#20b99a",
  brandPrimaryPressed: "#178f78",
  accentGold: "#b8860b",
  positive: "#18a879",
  negative: "#f05f48",
  warning: "#e1792f",
  info: "#0369a1",
  borderSubtle: "#e0ebe7",
  borderStrong: "#c7d8d2",
  // Hairline divider between dense list rows.
  rowDivider: "#e6efec"
} as const;

// Dark palette tuned for a dense ledger/expense-split feel:
// deep near-black canvas, slightly lifted surface rows, teal brand,
// orange for debt (you owe), teal-green for credit (owed to you).
// Keeps Baki's jade lineage while reading clearly in low light and
// handling long Bengali strings without color noise.
export const darkColors = {
  bgCanvas: "#101415",
  bgSurface: "#171c1e",
  bgSubtle: "#22292b",
  tintBrand: "#13322c",
  tintPositive: "#102e26",
  tintNegative: "#3a1d14",
  tintWarning: "#3a2814",
  tintInfo: "#0f2a3a",
  tintGold: "#3a2e10",
  inkPrimary: "#f7f8f8",
  inkSecondary: "#c3ced0",
  inkMuted: "#879396",
  inkOnBrand: "#0a1110",
  brandPrimary: "#38d89a",
  brandPrimaryPressed: "#25b77e",
  accentGold: "#f0b429",
  positive: "#3ecf8e",
  negative: "#fb923c",
  warning: "#fb923c",
  info: "#38bdf8",
  borderSubtle: "#252d30",
  borderStrong: "#3a464a",
  rowDivider: "#202729"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
  "5xl": 64
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  pill: 999
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(23, 35, 33, 0.06)",
  md: "0 6px 18px rgba(23, 35, 33, 0.08)",
  lg: "0 14px 34px rgba(23, 35, 33, 0.12)"
} as const;

export const theme = {
  dark: darkColors,
  light: lightColors,
  radii,
  shadows,
  spacing
} as const;

export type ColorToken = keyof typeof lightColors;
