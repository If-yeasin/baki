# V1 Release Candidate Gap Map

Updated: 2026-07-02

## Current Implemented Features

- Phone OTP auth, profile creation, persisted session, language/theme preference, sign-out, and account deletion client hook.
- Create/join/list khatas, invite-code display/copy, member strip, template rendering, and group detail ledger summary.
- Add expense through the `create_expense` RPC with integer-paisa split math, idempotency, activity logging, and offline queued-success handling for temporary RPC failures.
- Group and all-groups balance views using `get_group_balances`, local WatermelonDB fallback, and simplified next-action cards.
- Settlement plan through `simplify_debts`, raw-balance fallback, bKash/Nagad/cash/other outside-app settlement copy, and `create_settlement` idempotent replay.
- Activity reads real `activity_log` rows for group and tab views, with local fallback and actor hydration.
- Settings -> Sync shows pending/failed counts, failed item details, and manual retry.
- Group settings can rename, change type, archive, leave, safe-delete, copy/share/regenerate invites, and show member/admin/created-date metadata through server RPCs.
- `create_group`, `create_expense`, and `create_settlement` are idempotent RPC replay paths; direct client writes to group lifecycle, activity, and money tables are denied.
- Preview-only E2E auth is guarded by app-channel and Supabase-environment checks.
- CI runs lint, typecheck, tests, i18n parity, DB checks, mobile asset checks, E2E auth guard checks, release safety, aggregate `pnpm check`, and `git diff --check`.

## Partial Features

- Group lifecycle: user-facing settings and RPCs exist, but richer member management and custom avatar upload remain deferred.
- Expense lifecycle: create exists; edit/delete/receipt attachment are not implemented.
- Settlement lifecycle: create exists; settlement notes/references and failed-mutation repair/dismiss are incomplete.
- Activity feed: real rows render, but pull-to-refresh, pagination, richer event-specific rendering, and fully localized fallback actor names are incomplete.
- Notifications: Expo Notifications is installed and `device_tokens` exists, but token registration, preferences, and server delivery are not implemented.
- Settings/legal/export: placeholders exist for notifications, export, privacy, and support; store-review docs are not complete.
- Localization: Bengali/English catalogs are parity-checked and Bengali numerals render in existing formatters, but final native copy review is not recorded.

## Missing V1 Features

- Edit/delete expense RPCs and screens, with idempotent offline-safe mutation handling.
- Optional receipt attachment boundary with storage policies, or explicit deferred UI/docs if Storage is not configured.
- Raw versus simplified settlement toggle on the settlement screen.
- Failed sync item repair/dismiss UX with secret-safe debug copy.
- Push token registration and notification preferences.
- Export group CSV.
- Store listing docs for App Store Connect, Google Play, screenshots, privacy/data-safety answers, and reviewer notes.
- Expanded Maestro flows for edit/delete expense, group settings, language toggle, sync failure, notification preferences, and export if automatable.

## Risky Areas

- Money writes must remain RPC-only. Direct client inserts/updates to `expenses`, `expense_shares`, or `settlements` would break the release safety boundary.
- Expense edit/delete queue claims can overpromise until idempotent RPCs exist, so those queue types remain reserved only.
- Expense edit/delete changes must preserve audit rows, bigint-paisa invariants, share-total validation, and idempotency.
- New Supabase tables may need explicit grants and RLS review because current Supabase projects may not expose public tables to the Data API automatically.
- Notification implementation requires Expo credentials and a service-side sender; mobile must never receive a service-role key.
- EAS/Maestro preview E2E is optional until a hosted run is actually green.

## This Sprint Will Implement

- Release-candidate docs and stale-task cleanup so the repo no longer claims merged PR work is still pending.
- Direct-write security hardening and group lifecycle completion where it fits the existing schema/RLS patterns.
- Expense edit/delete backend and mobile surfaces only in a later slice if they can preserve RPC-only money writes and test coverage.
- Sync/settings UX improvements that are safe without changing the ledger model.
- Store-readiness docs and release checklists.
- Tests for any backend RPCs, form validation, view models, or queue behavior changed in this sprint.

## Out Of Scope For This Sprint

- Real payment processing, bKash merchant API, card/bank transfers, or in-app money movement.
- Production E2E auth bypass or any seeded-auth route outside local/preview/test builds.
- Regenerating or replacing the selected Baki app icon.
- Receipt OCR, recurring expenses, web app, admin dashboard, and friends-without-groups.
- Claiming manual real-device QA, hosted EAS/Maestro success, or native Bengali copy review unless those checks actually happen.

## Release-Blocking Items

- Required automated checks must pass: install, lint, typecheck, tests, i18n, DB checks, asset checks, E2E auth guard, release safety, aggregate check, and whitespace diff check.
- No direct client money-table writes.
- No service-role key in mobile code or env examples.
- Account deletion function deployment instructions and user-facing copy must remain accurate.
- Store-review docs must state that Baki records outside-app settlements and does not process payments.
- Any implemented group/expense/settlement mutation must be covered by DB or unit tests.

## Post-V1 / V1.1 Items

- Android production release after iOS closed beta.
- Hosted EAS/Maestro as a required release gate after a green preview-E2E run.
- Full push delivery if Expo push credentials or server-side secret setup block this sprint.
- Receipt upload if Supabase Storage policy design is not complete.
- Native Bengali copy review and real-device VoiceOver/TalkBack audit.
