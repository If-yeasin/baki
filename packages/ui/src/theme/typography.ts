export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: "700" },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: "700" },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: "600" },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  monoAmount: { fontSize: 22, lineHeight: 28, fontWeight: "600" }
} as const;

export type TypographyVariant = keyof typeof typography;
