# SETUP.md

## Prerequisites

- Node.js 24 LTS (use `nvm` or `mise`)
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

# Optional: verify active app icon assets
pnpm --filter mobile check:assets
```

## EAS build profiles (`apps/mobile/eas.json`)

```json
{
  "cli": { "version": ">= 16.0.1" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "development:device": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false }
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

- `ci.yml` — runs on every PR: install, local Supabase reset, lint, typecheck, tests, i18n parity, DB checks, asset checks, aggregate `pnpm check`, and `git diff --check`
- `eas-preview.yml` — on PR label `build:preview`: triggers `eas build --profile preview --platform ios`
- `release.yml` — on tag `v*`: triggers production EAS build + submit to App Store

Required secrets:

- `EXPO_TOKEN`
- `EAS_PROJECT_ID`
- `SUPABASE_ACCESS_TOKEN`
- `APPLE_APP_SPECIFIC_PASSWORD` (for submission)

## Supabase local development

```bash
pnpm --filter @baki/db exec supabase db start --workdir ../.. # spins up local Postgres
pnpm --filter @baki/db exec supabase db reset --workdir ../.. # apply all migrations + seed
```

Local dev env points to `http://127.0.0.1:55321` for the API and `postgresql://postgres:postgres@127.0.0.1:55322/postgres` for the database, matching the non-default ports in `supabase/config.toml` (set the API URL in `.env.local` for the `dev` profile).

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

## Phone preview options

Before TestFlight is wired up, contributors and stakeholders can preview the app on a physical iPhone via two paths. Pick the one that matches the kind of feedback you need.

| Feature          | Expo Go (Option A)        | Dev Client (Option B)         |
| ---------------- | ------------------------- | ----------------------------- |
| MMKV persistence | In-memory shim only       | Real native MMKV              |
| Sentry capture   | No-op (console only)      | Full native capture           |
| WatermelonDB     | Not available             | Available                     |
| Setup cost       | None (App Store download) | Apple Dev account + EAS build |
| Best for         | UI / layout / i18n smoke  | End-to-end behavioural QA     |

### Option A — Expo Go (lite preview)

**Requirements:** the native-safe wrappers in `apps/mobile/src/lib/*` (MMKV + Sentry runtime branching) must be in place. **Caveats:** no MMKV persistence (in-memory only — sessions and drafts vanish on reload), no Sentry capture, no WatermelonDB. Not a fidelity preview; use it for UI smoke only.

```bash
# From the repo root
pnpm --filter mobile dev:go
```

Then either scan the QR code with the Expo Go app on your iPhone, or open `exp://<your-mac-lan-ip>:8081` directly from Expo Go.

For off-LAN Expo Go testing, use the tunnel script. It forces the Expo Go launch target explicitly:

```bash
# From the repo root
pnpm --filter mobile dev:tunnel
```

### Option B — Dev Client (full preview)

**Requirements:** Apple Developer account, registered iPhone UDID, an EAS Build credit (free tier is fine for one build). This produces an `.ipa` you install on your device once; afterwards you can hot-reload JS against the running Dev Client.

```bash
# 1. One-time: register your iPhone with EAS (you'll be prompted for the UDID)
cd apps/mobile
eas device:create

# 2. Build the Dev Client binary for a physical device
eas build --profile development:device --platform ios

# 3. Install the resulting .ipa on the registered iPhone via the
#    EAS install link or TestFlight, then launch the Dev Client app
#    on the device.

# 4. Start the JS dev server in Dev Client mode from the repo root
cd ../..
pnpm --filter mobile dev:devclient
```

The Dev Client path gives you real MMKV persistence, real Sentry capture, and WatermelonDB — i.e. the same runtime surface as the preview/production binaries.

> Note: `apps/mobile/eas.json` ships two development profiles. `development` builds a Simulator-only `.app` (fast, free on Mac), while `development:device` builds an `.ipa` for a registered physical iPhone. Pick whichever matches the device you have in hand; both can coexist on the same EAS project.
> `pnpm --filter mobile build:ios:devclient` targets the physical-device profile. Use `pnpm --filter mobile build:ios:devclient:sim` when you specifically want the Simulator-only development build.

### SDK 54 preview verification status

Current status after the SDK 54 upgrade:

- **React Compiler is enabled for SDK 54** in `apps/mobile/app.config.ts` via `experiments.reactCompiler`. `expo export --platform ios --output-dir /tmp/baki-mobile-export --clear` now logs `React Compiler enabled` and completes successfully.
- **New Architecture config is valid for SDK 54:** no explicit `newArchEnabled` is set in app config. SDK 54 enables the New Architecture by default, and Expo Go only supports the New Architecture, so repeating the flag would add noise without changing runtime behavior.
- **Expo Doctor directory-check policy:** the intentional React Native Directory exclusions for `@nozbe/watermelondb` and its `@nozbe/simdjson` native dependency are appropriate because Baki's offline-first v1 runtime depends on WatermelonDB. They live in `apps/mobile/package.json` so the reliable app-directory Doctor invocation can read them.
- **Expo Go is the recommended QR path for lite UI smoke.** Use `pnpm --filter mobile dev:go`, then scan the QR from the Expo Go app on the iPhone. If the phone is not on the same LAN as the dev machine, use `pnpm --filter mobile dev:tunnel`.
- **Dev Client profiles are correctly split in `apps/mobile/eas.json`:** `development` is Simulator-only, `development:device` is the registered-device `.ipa`, `preview` is the internal preview binary, and `production` is the App Store/TestFlight binary.
- **Expo Doctor command caveat:** run Doctor from the app directory for now:
  ```bash
  cd apps/mobile
  pnpm dlx expo-doctor@latest --verbose
  ```
  The repo-root command `pnpm dlx expo-doctor@latest` currently fails before the checklist because it resolves the workspace root instead of the Expo app. The repo-root path form (`pnpm dlx expo-doctor@latest apps/mobile --verbose`) reaches the checklist but mis-resolves NativeWind/Tailwind config from the root, so it reports a Metro config error that does not reproduce from `apps/mobile`.
- **Current verification status:** `pnpm --filter mobile exec expo config --type public`, `pnpm --filter mobile typecheck`, and the iOS export command pass. Doctor should be run from `apps/mobile` so it reads the app package metadata and applies the documented WatermelonDB / `@nozbe/simdjson` exclusions.

## TestFlight preflight (Phase 4 exit)

This is the gate to flip the app from "runs on Simulator" to "goes to TestFlight." Walk through it linearly. An engineer + the product owner should both initial each section before `eas submit` is run.

### 1. Required env vars for an EAS preview build

The preview build pulls `EXPO_PUBLIC_*` values from **EAS Secrets** (set via `eas secret:create` or the EAS dashboard), not from the local `.env.local`. Set the following on the EAS project before running `eas build`:

| Name                            | Example value                           | Notes                                              |
| ------------------------------- | --------------------------------------- | -------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | `https://abcd1234.supabase.co`          | Live (not local) Supabase project URL              |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...`                         | Anon key only — **never** the service role         |
| `EXPO_PUBLIC_SENTRY_DSN`        | `https://xxx@o123.ingest.sentry.io/456` | Optional but strongly recommended for beta         |
| `EXPO_PUBLIC_ENABLE_BKASH`      | `true`                                  | Feature flag                                       |
| `EXPO_PUBLIC_ENABLE_NAGAD`      | `true`                                  | Feature flag                                       |
| `EAS_PROJECT_ID`                | UUID returned by `eas init`             | Picked up by `app.config.ts → extra.eas.projectId` |

**Hard rule:** `SUPABASE_SERVICE_ROLE_KEY` is **only** consumed by Supabase Edge Functions and is configured inside the Supabase dashboard. It must never appear in `apps/mobile/.env.local`, in EAS Secrets for the mobile app, or in any committed file. Shipping it to the client would bypass every RLS policy in `packages/db/migrations/`.

### 2. Pre-build checklist

- [ ] `pnpm install --frozen-lockfile` runs clean on a fresh clone.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm i18n:check`, `pnpm db:check` all green on `main`.
- [ ] `pnpm --filter @baki/db gen:types` re-run against the **live** Supabase project so `get_group_balances` is in the generated `Database` type (not just the local one).
- [ ] `supabase db push` against the live project — all migrations in `packages/db/migrations/` applied, including the idempotent expense/settlement RPC migrations.
- [ ] `supabase functions deploy delete-account` against the live project — `supabase/config.toml` sets `[functions.delete-account].verify_jwt = false` so the function can translate auth failures into Baki's JSON error contract, then call `public.delete_my_account()` with the caller's bearer token and the anon key.
- [ ] RLS verified end-to-end with two test users (see `packages/db/tests/rls-policies.test.ts`).
- [ ] `.env.local` on the dev machine is populated for local runs; the EAS build itself picks `EXPO_PUBLIC_*` from EAS Secrets, **not** the local file — confirm via the EAS dashboard before kicking off the build.
- [ ] App icon (1024×1024 PNG, no alpha channel), adaptive icon, and notification icon all present in `apps/mobile/assets/icons/`.
- [ ] `LSApplicationQueriesSchemes` includes `bkashopen` and `nagad` (already in `app.config.ts` — verify it survived any merge).
- [ ] Phone OTP provider configured in Supabase Auth (SSL Wireless or Twilio with Bangladesh coverage). A test phone number is allow-listed.
- [ ] `pnpm --filter mobile check:assets` passes.

### 3. Build & submit commands

Run from `apps/mobile/`:

```bash
cd apps/mobile
eas login
eas build --profile preview --platform ios
# ... wait for build (typically 15–25 minutes on m-medium) ...
eas submit --platform ios --profile production
```

> **Submission blocker:** `apps/mobile/eas.json` currently contains placeholder values in `submit.production.ios` — `appleId: "your-apple-id@example.com"`, `ascAppId: "1234567890"`, `appleTeamId: "ABCDE12345"`. These must be replaced with real Apple Developer credentials **before** `eas submit` will succeed. Do not commit the real values; set them via `eas secret:create` or pass them inline via `EXPO_APPLE_ID`, `EXPO_ASC_APP_ID`, `EXPO_APPLE_TEAM_ID` environment variables.

### 4. Dev Client limitations & manual OTP step

- The app depends on native modules (`react-native-mmkv`, `@nozbe/watermelondb`, `react-native-reanimated`, `@sentry/react-native`) that **Expo Go cannot host**. You must build the Dev Client at least once:
  ```bash
  eas build --profile development:device --platform ios
  ```
  Install the resulting `.ipa` on a device via the EAS install link after `eas device:create`. For a Simulator-only dev client, use `eas build --profile development --platform ios` instead.
- **First-run OTP for testers:** Bangladeshi SMS providers (SSL Wireless, Twilio) may not deliver to certain Apple-internal test numbers used by App Review. For local QA, retrieve the OTP from Supabase Studio → Auth → Users → "Send magic link", or read directly from `auth.audit_log_entries` for the test number.
- **Maestro flows assume a signed-in state at launch.** Document the manual sign-in step in the flow README so a fresh tester knows to log in once before invoking `maestro test`.

### 5. Physical device test plan (must complete before TestFlight upload)

- [ ] **iPhone SE (2nd gen) minimum** — the oldest supported device per `docs/DESIGN_SYSTEM.md`. Bengali rendering and Hind Siliguri font metrics must be verified on real hardware, not just the Simulator.
- [ ] Verify the dark-mode loading screen renders cleanly (the theme-aware splash just landed in this wave).
- [ ] Run all five Maestro flows manually if Maestro Cloud is not yet configured.
- [ ] Verify bKash deep link opens the bKash app on a device that has bKash installed; verify the Nagad fallback copies the USSD string to the clipboard (Nagad has no documented universal deep link — copy-to-clipboard is the contract).
- [ ] Airplane-mode test: add an expense, kill app, restore connectivity, confirm WatermelonDB → Supabase sync converges.

### 6. App Store metadata gaps (Apple submission gate)

- **Account deletion (Apple Guideline 5.1.1(v)):** Settings → "Delete account" calls the `delete-account` Supabase Edge Function, which invokes `public.delete_my_account()` with the user's JWT, reassigns ledger rows to the tombstone profile where needed, deletes the `auth.users` row, and signs the client out locally. This must be deployed to the live Supabase project and verified with the reviewer test account before public App Store submission. Demo path for the App Store reviewer: sign in with the test account → Settings → Delete account → confirm; the account is removed within 30 days per Apple's policy. See "Account deletion" in docs/DATA_MODEL.md for the cascade strategy and Edge Function contract.
- **Privacy nutrition labels** — declare exactly: phone number (linked to identity), display name (linked to identity), optional bKash/Nagad numbers (linked to identity), Sentry telemetry (crash data, not linked).
- **"Sign in with Apple"** is not strictly required because we use only phone OTP (no other third-party social login). Apple sometimes pushes back regardless — keep this reviewer note ready: _"Baki authenticates via SMS OTP only. No third-party social login is offered, so Guideline 4.8 does not apply."_
- **Reviewer notes:** explicitly state that Baki is an expense ledger; it does not process payments, hold funds, or authorize transactions. bKash/Nagad actions only open the user's own installed app or surface a copy fallback. Provide a demo phone number and pre-loaded test data plus an OTP bypass account (Apple reviewers cannot complete real SMS OTP).
- **Age rating:** 4+. **Category:** Finance.
