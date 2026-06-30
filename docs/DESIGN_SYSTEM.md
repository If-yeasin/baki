# DESIGN_SYSTEM.md

## Design philosophy

বাকি should feel like a modern interpretation of a corner-shop খাতা — warm, trustworthy, slightly handcrafted, never sterile. The visual identity borrows from accountant's ledger paper, the green of crisp new ৳500 notes, and the gold of family heirloom jewelry. It is decisively *not* a generic SaaS blue.

## Reference boundary

Splitwise is a usability benchmark, not a visual source to clone. Baki should match the clarity of quick balance scanning, concrete next actions, dense ledger rows, and low-friction expense entry. Baki must not copy Splitwise's brand colors, logo marks, exact layouts, icon choices, wording, illustrations, or screen composition. Every borrowed lesson should be translated through Baki's Bengali-first khata metaphor, jade/gold palette, bKash/Nagad settlement model, and offline-first constraints.

## Color tokens

### Light theme
| Token | Hex | Use |
|---|---|---|
| `bg.canvas` | `#faf6ef` | App background — warm cream, ledger paper |
| `bg.surface` | `#ffffff` | Cards, modals |
| `bg.subtle` | `#f1ece1` | Section dividers, input backgrounds |
| `ink.primary` | `#0d1b1e` | Primary text |
| `ink.secondary` | `#4a5b5e` | Secondary text |
| `ink.muted` | `#8a9395` | Captions, placeholders |
| `brand.primary` | `#0d7c66` | Primary actions, brand — deep jade |
| `brand.primary-pressed` | `#0a5f4f` | Pressed state |
| `accent.gold` | `#b8860b` | Highlights, gilded details |
| `positive` | `#16a34a` | Credits, "owed to you" |
| `negative` | `#dc2626` | Debits, "you owe" |
| `warning` | `#d97706` | Warnings |
| `info` | `#0369a1` | Info banners |
| `border.subtle` | `#e7e1d3` | Subtle dividers |
| `border.strong` | `#c8bfaa` | Strong dividers, input borders |

### Dark theme
| Token | Hex |
|---|---|
| `bg.canvas` | `#0d1b1e` |
| `bg.surface` | `#152428` |
| `bg.subtle` | `#1f3034` |
| `ink.primary` | `#f5f0e3` |
| `ink.secondary` | `#b8c5c7` |
| `ink.muted` | `#7c8a8c` |
| `brand.primary` | `#3ecf8e` |
| `brand.primary-pressed` | `#34b97f` |
| `accent.gold` | `#f0b429` |
| `positive` | `#4ade80` |
| `negative` | `#f87171` |
| `warning` | `#fb923c` |
| `info` | `#38bdf8` |
| `border.subtle` | `#1f3034` |
| `border.strong` | `#2d4045` |

## Typography

### Fonts

- **Bengali UI:** `Hind Siliguri` (Google Fonts) — weights 400, 500, 600, 700. Bundle locally in `apps/mobile/assets/fonts/`.
- **English UI:** `Inter` — weights 400, 500, 600, 700.
- **Numerals (English):** `Inter` with tabular figures variant
- **Numerals (Bengali):** rendered in `Hind Siliguri`; convert digits at the formatter level

The `<Text />` component picks the family based on the active locale.

### Type scale

| Token | Size | Line | Weight | Use |
|---|---|---|---|---|
| `display` | 32 | 40 | 700 | Empty-state hero |
| `h1` | 24 | 32 | 700 | Screen titles |
| `h2` | 20 | 28 | 600 | Section headers |
| `h3` | 17 | 24 | 600 | Card titles |
| `body` | 15 | 22 | 400 | Body copy |
| `body-strong` | 15 | 22 | 600 | Emphasized body |
| `caption` | 13 | 18 | 400 | Captions, metadata |
| `label` | 12 | 16 | 600 | Form labels, eyebrow |
| `mono-amount` | 22 | 28 | 600 | Money displays (tabular figures) |

## Spacing & radii

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 48, 64
- Border radii: `sm` 6, `md` 10, `lg` 14, `xl` 20, `pill` 999
- Shadow tokens: `sm`, `md`, `lg` — subtle, never harsh

## Component library (in `packages/ui`)

Build these first; every screen composes from them.

- `<Text variant="…" />` — typography wrapper, picks font by locale
- `<Money amountPaisa={…} variant="positive|negative|neutral" />` — locale-aware money
- `<Button variant="primary|secondary|ghost|destructive" size="sm|md|lg" />`
- `<Input />`, `<NumericInput />`, `<PhoneInput />` (BD prefix +880, locked)
- `<Avatar name={…} url={…} size="sm|md|lg" />` — initials fallback, deterministic color from name hash
- `<Card />` — subtle border, surface bg, sm radius
- `<ListItem leading={...} title trailing={...} subtitle />` — workhorse row
- `<Sheet />` — bottom sheet wrapper around @gorhom/bottom-sheet
- `<Toast />` — non-blocking feedback
- `<EmptyState illustration title body cta />`
- `<Skeleton />` — loading shimmer
- `<Tabs />`, `<Chip />`, `<Badge />`
- `<DatePicker />` — Bengali calendar labels when locale=bn

## Iconography

- **Lucide React Native** as the base set
- Custom money/bKash/Nagad glyphs in `packages/ui/src/icons/` — keep monoline, 1.5px stroke
- Always render at 16, 20, or 24

## Motion

- Reanimated 3
- Standard transition: 220ms cubic-bezier(0.32, 0.72, 0, 1)
- Press feedback: 100ms scale to 0.97
- Pages: native stack default; modals: slide-from-bottom
- Never animate longer than 400ms

## Accessibility

- Minimum tap target: 44×44
- Color contrast: AA at minimum for body text, AAA for amounts
- All interactive elements have `accessibilityLabel` (localized)
- Money components announce as "৪৫০ টাকা, you are owed" / "450 taka, you are owed"
- Test with VoiceOver (iOS) and TalkBack (Android) once per release

## App icon & splash

- App icon: stylized খ (Bengali "kha", first letter of খাতা) inside a coin-like circle; jade green on cream, gold inner stroke
- Splash: cream background, centered icon, no text (avoids localization split)
- Adaptive icon (Android): same mark on a jade tile

## Empty states

Every list view has a designed empty state with:
- A simple line illustration (commissioned, not stock)
- A localized 2-line hint
- A primary CTA

Examples to design:
- No groups: "তোমার প্রথম খাতা তৈরি করো" / "Create your first khata"
- No expenses in group: "প্রথম খরচ যোগ করো" / "Add the first expense"
- All settled: "সব হিসাব মিটে গেছে 🎉" / "All settled up 🎉"
