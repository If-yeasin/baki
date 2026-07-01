# BRAND.md

## Identity

- **App name:** Baki / বাকি
- **Product description:** Bengali-first shared expense ledger for Bangladesh.
- **Brand rule:** Splitwise-level usability is only a benchmark. Do not copy Splitwise branding, colors, layouts, wording, icons, illustrations, or exact screen composition.

## App Icon Source Of Truth

The mobile app bundles only the active icon files referenced by `apps/mobile/app.config.ts`:

| Use                         | File                                             |
| --------------------------- | ------------------------------------------------ |
| iOS/app icon                | `apps/mobile/assets/icons/icon.png`              |
| Android adaptive foreground | `apps/mobile/assets/icons/adaptive-icon.png`     |
| Notification glyph          | `apps/mobile/assets/icons/notification-icon.png` |

Unused icon experiments and previews live outside the app bundle at `docs/brand/icon-explorations/`. Do not move them back under `apps/mobile/assets/` unless the app config references them, because `assetBundlePatterns` includes `**/*`.

## Colors

- **Primary green/teal:** `#0d7c66`
- **Pressed green/teal:** `#0a5f4f`
- **Cream/white monogram:** warm cream/off-white, used on the Baki monogram.

Keep the selected simple Baki monogram as the app icon. Do not regenerate it during feature work.

## Usage Rules

- `icon.png` must remain a square PNG of at least 1024x1024 and must not have transparency for App Store use.
- `adaptive-icon.png` is the Android adaptive foreground and should keep transparency.
- `notification-icon.png` is the Expo Notifications glyph and should keep transparency.
- Run `pnpm --filter mobile check:assets` after changing icon files.
- Keep icon experiments in `docs/brand/icon-explorations/`, not in the mobile asset bundle.
