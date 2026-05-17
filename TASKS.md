# Phase 1 Tasks

These tasks come from `docs/ROADMAP.md` Phase 1. Work through them in order and keep `docs/` updated before changing product behavior.

## 1. Design System Foundation

**Owner:** `design-system-engineer`

- Expand `packages/ui` tokens, typography, and component variants.
- Add `Input`, `NumericInput`, `PhoneInput`, `Sheet`, `Toast`, `EmptyState`, `Skeleton`, `Tabs`, `Chip`, `Badge`, and `DatePicker`.
- Add component tests for Bengali and English labels.
- Add the dev-only component demo route under `apps/mobile/app/dev/components.tsx`.

## 2. i18n Foundation

**Owner:** `design-system-engineer`

- Fill out `bn` and `en` catalogs for F1 auth and the empty home flow.
- Keep catalog parity enforced by `pnpm i18n:check`.
- Add locale-aware date helpers for Asia/Dhaka.
- Add Bengali numeral tests for money, dates, and counters.

## 3. Auth Flow

**Owner:** `mobile-engineer`

- Build phone-number entry with `+880` locked and Bangladesh validation.
- Build OTP verification with Supabase Auth.
- Persist session through MMKV-backed Supabase storage.
- Build first-run profile creation for display name and optional avatar.

## 4. Supabase Schema Verification

**Owner:** `backend-engineer`

- Run local migrations and seed data.
- Generate `packages/db/src/types.ts`.
- Add RLS tests with two users in separate groups.
- Verify no cross-group profile, group, expense, settlement, or activity leakage.

## 5. Offline Store Skeleton

**Owner:** `mobile-engineer`

- Expand WatermelonDB models for groups, members, expenses, expense shares, settlements, and activity.
- Add the mutation queue skeleton.
- Hydrate reads from WatermelonDB before remote revalidation.
- Show a localized sync indicator in the app header.

## 6. Release Plumbing

**Owner:** `release-engineer`

- Confirm EAS project configuration after the human runs `eas init`.
- Add preview build workflow once `EXPO_TOKEN` exists.
- Document TestFlight setup and Apple reviewer notes.

## Exit Criteria

- New user can sign up via phone OTP.
- User lands on an empty home screen with a localized "Create your first khata" CTA.
- Supabase RLS tests pass with two users.
- Offline store is wired for empty entities.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm i18n:check` pass.
