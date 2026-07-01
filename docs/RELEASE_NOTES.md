# Release Notes

## 0.2.6 — Trusted tester MVP hardening (2026-07-01)

- Moved unused icon explorations out of the Expo-bundled mobile assets and
  documented the selected Baki monogram in `docs/BRAND.md`.
- Wired queued expense/settlement replay into authenticated startup,
  foreground, interval, and manual retry via Settings -> Sync.
- Added WatermelonDB local cache scaffolding for groups, expenses, balances,
  settlements, and activity, with local balance fallback tests.
- Switched the settle screen to the typed `simplify_debts` plan with raw
  balance fallback only when the simplified RPC fails.
- Added real `activity_log` rendering for group history and the Activity tab.

## 0.2.5 — Repo stabilization pass (2026-06-30)

- Replaced the remaining unsafe product comparison with safer Bengali-first
  ledger positioning while preserving Splitwise only as a
  usability benchmark boundary in design docs.
- Updated stale architecture notes for the current Expo SDK 54 / React Native
  0.81.5 / Reanimated 4 workspace and the generated Supabase types location.
- Aligned create-khata validation with the database `groups.name` 50-character
  constraint and gave invite-code validation its own non-OTP copy.
- Added deploy documentation for the `delete-account` Supabase Edge Function.

## 0.2.4 — Account deletion Edge Function (2026-06-25)

- Added the `delete-account` Supabase Edge Function for Apple's in-app
  account deletion requirement. It calls `public.delete_my_account()` with the
  caller's JWT and the anon key, preserving RLS/auth context without a
  service-role bypass.
- Hardened the mobile deletion hook so a successful server-side deletion clears
  local auth/profile cache and does not report a false failure after the auth
  row has been removed.
- Removed stale "account deletion coming soon" copy and updated the App Store
  preflight notes to track deployment/QA instead of implementation.

## 0.2.3 — SDK 54 preview verification (2026-05-20)

Release-preview verification after the Expo SDK 54 upgrade:

- Raised the EAS CLI floor to `>= 16.0.1` for SDK 54-era builds.
- Enabled the SDK 54 React Compiler experiment in the Expo app config and
  removed the redundant explicit New Architecture flag.
- Documented the intentional Expo Doctor directory-check exclusions for
  WatermelonDB and `@nozbe/simdjson`; Baki keeps these because offline-first
  ledgers are a v1 requirement.
- Confirmed the intended phone paths: Expo Go for lite UI/i18n smoke via
  `pnpm --filter mobile dev:go` on LAN or
  `pnpm --filter mobile dev:tunnel` off-LAN,
  and Dev Client for full native QA via
  `pnpm --filter mobile build:ios:devclient`.
- Updated `dev:tunnel` to force Expo Go, pointed `build:ios:devclient` at the
  physical-device EAS profile, and kept `build:ios:devclient:sim` for the
  Simulator-only development profile.
- Re-verified that iOS export now completes with React Compiler enabled.
- Logged the remaining Doctor caveats: run Doctor from `apps/mobile`; the
  repo-root invocation resolves the wrong project, while the app-directory run
  can read the WatermelonDB / `@nozbe/simdjson` exclusions from
  `apps/mobile/package.json`.

## 0.2.2 — Phone preview enablement (2026-05-19)

Multi-agent wave to unblock real-device preview ahead of TestFlight:

- **Expo Go (lite) path:** native-safe runtime branching for MMKV
  and Sentry so the app boots inside Expo Go (in-memory storage,
  no Sentry capture) for UI smoke.
- **Dev Client (full) path:** `expo-dev-client` added to mobile
  dependencies; new EAS `development:device` profile for a registered
  physical iPhone (`ios.simulator: false`), sibling to the existing
  Simulator-only `development` profile.
- **Scripts:** `dev:go` (Expo Go, LAN), `dev:tunnel` (off-LAN),
  `dev:devclient` (Dev Client, LAN), and `build:ios:devclient`
  (`eas build --profile development --platform ios`) added to
  `apps/mobile/package.json`.
- **Docs:** new "Phone preview options" section in `docs/SETUP.md`
  with an Expo Go vs Dev Client comparison table and exact commands.

## 0.2.1 — TestFlight stabilization (2026-05-18)

Cross-agent wave hardening the build for the first TestFlight upload:

- **Design system:** theme-aware loading screen — splash and initial
  navigation now respect light/dark `userInterfaceStyle` without a
  white flash.
- **E2E:** stable Maestro `testID`s landed for the critical flows —
  `tab-groups`, `tab-balances`, `tab-activity`, `tab-settings` (via
  `tabBarButtonTestID`) and `settle-row-{idx}` / `settle-bkash-{idx}` /
  `settle-nagad-{idx}` / `settle-cash-{idx}` / `settle-other-{idx}`
  wrappers on the settlement screen.
- **Types:** eliminated the remaining `any` cast on the
  `get_group_balances` RPC; the balances feature is now end-to-end
  type-safe against the generated `Database` schema.
- **Release tooling:** added the TestFlight preflight checklist to
  `docs/SETUP.md` covering EAS Secrets, the dev-client OTP workaround,
  the physical-device test plan, and the App Store metadata gates
  (account deletion is flagged as a v1.0 blocker).

## 0.2.0 — MVP wave (2026-05-18)

Multi-agent slice covering the first end-to-end skeleton:

- **Backend:** RLS policies on `groups`, `group_members`, `expenses`,
  `expense_splits`, `settlements`, `activities`; balances RPC returning
  net per-user amounts; sequential migration set finalized.
- **Design system:** typography tokens, Bengali-first text component,
  base `Button`, `Card`, `Input`, `Sheet`, `Toast`, empty-state and
  list-row primitives shared via `@baki/ui`.
- **Payments:** bKash/Nagad MFS number validation (Zod), deep-link
  builder with `tel:` USSD fallback, copy-to-clipboard last-resort path.
- **Mobile:** auth (phone OTP), home with khata list, create-group,
  add-expense, balances, settle, and activity skeleton screens.
- **Release tooling:** root `check`, `db:check`, and `e2e`
  documentation scripts; Turborepo `check` pipeline; Maestro
  critical-path flow skeleton under `e2e/maestro/`; CI workflows
  retained for PR lint/typecheck/test/i18n parity.

## 0.1.0 — Bootstrap

- Scaffolded the Expo SDK 52 mobile app.
- Added Supabase schema, seed data, and generated types.
- Added Bengali-first i18n foundation.
- Added shared UI tokens and starter primitives.
- Added local bKash/Nagad deep-link planning helpers.
- Added EAS development, preview, and production build profiles.

## Reviewer Notes Draft

Baki is an expense ledger and shared khata. It does not hold money, process payments, or authorize transactions. bKash and Nagad actions only open the user's installed payment app or provide a copy fallback; the user completes payment outside Baki and confirms settlement back in the app.
