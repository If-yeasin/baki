export const lightColors = {
  bgCanvas: "#faf6ef",
  bgSurface: "#ffffff",
  bgSubtle: "#f1ece1",
  inkPrimary: "#0d1b1e",
  inkSecondary: "#4a5b5e",
  inkMuted: "#8a9395",
  brandPrimary: "#0d7c66",
  brandPrimaryPressed: "#0a5f4f",
  accentGold: "#b8860b",
  positive: "#16a34a",
  negative: "#dc2626",
  warning: "#d97706",
  info: "#0369a1",
  borderSubtle: "#e7e1d3",
  borderStrong: "#c8bfaa"
} as const;

export const darkColors = {
  bgCanvas: "#0d1b1e",
  bgSurface: "#152428",
  bgSubtle: "#1f3034",
  inkPrimary: "#f5f0e3",
  inkSecondary: "#b8c5c7",
  inkMuted: "#7c8a8c",
  brandPrimary: "#3ecf8e",
  brandPrimaryPressed: "#34b97f",
  accentGold: "#f0b429",
  positive: "#4ade80",
  negative: "#f87171",
  warning: "#fb923c",
  info: "#38bdf8",
  borderSubtle: "#1f3034",
  borderStrong: "#2d4045"
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
