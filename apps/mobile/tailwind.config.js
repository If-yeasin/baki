/** @type {import('tailwindcss').Config} */
// All color aliases are CSS-variable-driven; the runtime swap between dark
// (default) and light lives in global.css. Tokens mirror the names in
// packages/ui/src/theme/tokens.ts so design-system consumers can reach the
// same name from either side. Do NOT add static hex fallbacks here — they
// will silently override the runtime theme.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Surfaces
        "bg-canvas": "rgb(var(--bg-canvas) / <alpha-value>)",
        "bg-surface": "rgb(var(--bg-surface) / <alpha-value>)",
        "bg-subtle": "rgb(var(--bg-subtle) / <alpha-value>)",
        // Soft tints used for badges/pills/state backgrounds
        "tint-brand": "rgb(var(--tint-brand) / <alpha-value>)",
        "tint-positive": "rgb(var(--tint-positive) / <alpha-value>)",
        "tint-negative": "rgb(var(--tint-negative) / <alpha-value>)",
        "tint-warning": "rgb(var(--tint-warning) / <alpha-value>)",
        "tint-info": "rgb(var(--tint-info) / <alpha-value>)",
        "tint-gold": "rgb(var(--tint-gold) / <alpha-value>)",
        // Foreground
        "ink-primary": "rgb(var(--ink-primary) / <alpha-value>)",
        "ink-secondary": "rgb(var(--ink-secondary) / <alpha-value>)",
        "ink-muted": "rgb(var(--ink-muted) / <alpha-value>)",
        "ink-on-brand": "rgb(var(--ink-on-brand) / <alpha-value>)",
        // Brand + semantic
        "brand-primary": "rgb(var(--brand-primary) / <alpha-value>)",
        "brand-primary-pressed": "rgb(var(--brand-primary-pressed) / <alpha-value>)",
        "accent-gold": "rgb(var(--accent-gold) / <alpha-value>)",
        positive: "rgb(var(--positive) / <alpha-value>)",
        negative: "rgb(var(--negative) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
        // Borders + hairlines
        "border-subtle": "rgb(var(--border-subtle) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        "row-divider": "rgb(var(--row-divider) / <alpha-value>)"
      }
    }
  },
  plugins: []
};
