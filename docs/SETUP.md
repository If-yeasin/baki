# SETUP.md

## Prerequisites

- Node.js 20 LTS (use `nvm` or `mise`)
- pnpm 9+
- Watchman (macOS): `brew install watchman`
- Xcode 16+ (for iOS builds; macOS only)
- Android Studio (for Android, Phase 6)
- Expo account: sign up at expo.dev
- Supabase account: sign up at supabase.com
- Apple Developer account ($99/year — required for App Store)
- Google Play Console account ($25 one-time — required for Play Store)
- EAS CLI: `npm i -g eas-cli`
- Supabase CLI: `brew install supabase/tap/supabase` (or via npm)

## Environment variables

All env vars live in `apps/mobile/.env.local` (gitignored) and are exposed to the app via `expo-constants` with the `EXPO_PUBLIC_` prefix for public values.

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Sentry
EXPO_PUBLIC_SENTRY_DSN=

# Feature flags
EXPO_PUBLIC_ENABLE_NAGAD=true
EXPO_PUBLIC_ENABLE_BKASH=true

# Build
EAS_PROJECT_ID=

# Server-only (Edge Functions secrets, configured in Supabase dashboard)
# - SMS_PROVIDER_API_KEY
# - SUPABASE_SERVICE_ROLE_KEY   (never in mobile app)
```

A `.env.example` (committed) lists every required key with empty values.

## First-time setup commands

```bash
# 1. Clone & install
git clone <repo>
cd baki
pnpm install

# 2. Supabase: link & migrate
supabase login
supabase link --project-ref <ref>
pnpm --filter db migrate

# 3. Generate Supabase types
pnpm --filter db gen:types

# 4. Configure Expo / EAS
cd apps/mobile
eas login
eas init   # creates EAS project, writes EAS_PROJECT_ID

# 5. Start the dev server
cd ../..
pnpm --filter mobile dev
```

## EAS build profiles (`apps/mobile/eas.json`)

```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": { "resourceClass": "m-medium" }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true,
      "ios": { "resourceClass": "m-medium" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDE12345"
      },
      "android": {
        "serviceAccountKeyPath": "./play-store-credentials.json",
        "track": "internal"
      }
    }
  }
}
```

## CI (GitHub Actions)

Workflows in `.github/workflows/`:

- `ci.yml` — runs on every PR: lint, typecheck, unit tests, i18n parity check, Supabase migration dry-run
- `eas-preview.yml` — on PR label `build:preview`: triggers `eas build --profile preview --platform ios`
- `release.yml` — on tag `v*`: triggers production EAS build + submit to App Store

Required secrets:
- `EXPO_TOKEN`
- `SUPABASE_ACCESS_TOKEN`
- `APPLE_APP_SPECIFIC_PASSWORD` (for submission)

## Supabase local development

```bash
supabase start    # spins up local Postgres, Studio, Auth, etc.
supabase db reset # apply all migrations + seed
```

Local dev env points to `http://localhost:54321` (set in `.env.local` for the `dev` profile).

## Apple App Store prep checklist

- [ ] Apple Developer enrollment complete
- [ ] Bundle identifier reserved: `com.baki.app`
- [ ] App Store Connect: app created in Finance category
- [ ] Privacy policy URL hosted (use a simple GitHub Pages site)
- [ ] Support URL hosted
- [ ] App icon: 1024×1024 PNG, no transparency
- [ ] Screenshots: 6.7", 6.5", 5.5" iPhone — both BN and EN
- [ ] Preview video (optional but recommended)
- [ ] Privacy nutrition labels filled (data collected: phone, name, optional MFS numbers)
- [ ] Sign in with Apple (NOT required — we use phone OTP only, but Apple sometimes pushes back; have an answer)
- [ ] Account deletion flow shipped in-app

## Google Play Console prep checklist

- [ ] Developer account created ($25)
- [ ] Application: `com.baki.app`
- [ ] Content rating questionnaire complete
- [ ] Privacy policy URL
- [ ] Data safety form filled
- [ ] Closed testing track with ≥ 20 testers running ≥ 14 days (Play's recent requirement)

## Local Supabase migrations workflow

1. Modify `docs/DATA_MODEL.md` first
2. Write SQL in `packages/db/migrations/NNN_name.sql` (sequentially numbered)
3. Run `pnpm --filter db migrate:local` to apply
4. Run `pnpm --filter db gen:types` to regenerate `types.ts`
5. Commit migration + types together

## Troubleshooting cheatsheet

- **"Metro bundler stuck":** `pnpm --filter mobile dev --clear`
- **Bengali font not rendering:** check `expo-font` loaded the file; verify `Text` component picks the family by locale
- **bKash deep link not opening:** confirm `LSApplicationQueriesSchemes` includes the bKash scheme in `app.config.ts → ios.infoPlist`
- **EAS build OOM:** bump `resourceClass` to `m-large`
- **Supabase RLS blocking a query:** test with `supabase.auth.getUser()` — confirm session is attached; check policies in Studio
