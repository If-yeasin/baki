export const lightColors = {
  bgCanvas: "#faf6ef",
  bgSurface: "#ffffff",
  bgSubtle: "#f1ece1",
  // Tinted surfaces used for soft state backgrounds (badges, pills).
  tintBrand: "#dff3ec",
  tintPositive: "#dcfce7",
  tintNegative: "#fee2e2",
  tintWarning: "#ffedd5",
  tintInfo: "#e0f2fe",
  tintGold: "#fff7dc",
  inkPrimary: "#0d1b1e",
  inkSecondary: "#4a5b5e",
  inkMuted: "#8a9395",
  // Foreground used on filled brand/destructive backgrounds.
  inkOnBrand: "#ffffff",
  brandPrimary: "#0d7c66",
  brandPrimaryPressed: "#0a5f4f",
  accentGold: "#b8860b",
  positive: "#16a34a",
  negative: "#dc2626",
  warning: "#d97706",
  info: "#0369a1",
  borderSubtle: "#e7e1d3",
  borderStrong: "#c8bfaa",
  // Hairline divider between dense list rows.
  rowDivider: "#ece6d6"
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
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(13, 27, 30, 0.06)",
  md: "0 8px 24px rgba(13, 27, 30, 0.08)",
  lg: "0 16px 40px rgba(13, 27, 30, 0.12)"
} as const;

export const theme = {
  dark: darkColors,
  light: lightColors,
  radii,
  shadows,
  spacing
} as const;

export type ColorToken = keyof typeof lightColors;
