# V1 Release Candidate Gap Map

Updated: 2026-07-04

## Current Implemented Features

- Phone OTP auth, profile creation, persisted session, language/theme preference, sign-out, and account deletion client hook.
- Create/join/list khatas, invite-code display/copy, member strip, template rendering, and group detail ledger summary.
- Add/edit/delete expense through RPC-only ledger paths with integer-paisa split math, idempotency, activity logging, and offline queued-success handling for temporary RPC failures.
- Group and all-groups balance views using `get_group_balances`, local WatermelonDB fallback, and simplified next-action cards.
- Settlement plan through `simplify_debts`, raw-balance fallback, bKash/Nagad/cash/other outside-app settlement copy, and `create_settlement` idempotent replay.
- Activity reads real `activity_log` rows for group and tab views, with local fallback, actor hydration, pull-to-refresh, and load-more pagination.
- Settings -> Sync shows pending/failed counts, failed item details, manual retry, per-item retry, redacted debug copy, and guarded dismiss for permanent failures.
- Settings includes CSV ledger export, Expo push token registration/preferences with token-aware device status, privacy/terms, and support screens.
- Group settings can rename, change type, archive, leave, safe-delete, copy/share/regenerate invites, and show member/admin/created-date metadata through server RPCs.
- `create_group`, `create_expense`, `edit_expense`, `delete_expense`, and `create_settlement` are idempotent RPC replay paths; direct client writes to group lifecycle, activity, and money tables are denied, and money-writing RPCs reject archived/deleted groups.
- Preview-only E2E auth is guarded by app-channel and Supabase-environment checks.
- CI runs lint, typecheck, tests, i18n parity, DB checks, generated DB type checks, mobile asset checks, E2E auth guard checks, release safety, aggregate `pnpm check`, and `git diff --check`.

## Partial Features

- Group lifecycle: user-facing settings and RPCs exist, but richer member management and custom avatar upload remain deferred.
- Expense lifecycle: create/edit/delete exist; receipt attachment remains deferred.
- Settlement lifecycle: create exists and the screen offers simplified versus raw-balance views; settlement notes/references remain incomplete.
- Activity feed: real rows render with refresh/pagination; richer event-specific rendering remains future polish.
- Notifications: Expo token registration and user preferences exist with token-aware device status; server delivery is not implemented.
- Settings/legal/export: CSV export and in-app privacy/terms/support screens exist; hosted store-review URLs and final legal review are not complete.
- Localization: Bengali/English catalogs are parity-checked, Bengali numerals render in existing formatters, and `docs/I18N_COPY_REVIEW.md` is prepared, but final native copy review is not recorded.

## Missing V1 Features

- Optional receipt attachment boundary with storage policies, or explicit deferred UI/docs if Storage is not configured.
- Server-side push notification delivery.
- Hosted legal/support/privacy URLs for store review; static pages are prepared in `docs-site/` but not deployed.
- Final store listing package: draft docs exist, but screenshots, hosted URLs, final account credentials, privacy/data-safety submission evidence, and reviewer test-account evidence are missing.
- Expanded Maestro flows for edit/delete expense, group settings, language toggle, sync failure, notification preferences, and export if automatable.

## Risky Areas

- Money writes must remain RPC-only. Direct client inserts/updates to `expenses`, `expense_shares`, or `settlements` would break the release safety boundary.
- Expense edit/delete paths must continue to preserve audit rows, bigint-paisa invariants, share-total validation, idempotency, and RPC-only replay.
- New Supabase tables may need explicit grants and RLS review because current Supabase projects may not expose public tables to the Data API automatically.
- Notification implementation requires Expo credentials and a service-side sender; mobile must never receive a service-role key.
- EAS/Maestro preview E2E is optional until a hosted run is actually green.

## Beta Production-Readiness Sprint

- Release-truth cleanup so docs no longer claim merged PR work is still pending.
- Database/typegen integrity gates: fresh migration reset, no silent CI DB-test skips, generated-type stale check, and direct-write/RPC grant assertions.
- Receipt attachment either implemented with safe Storage policies and tests, or explicitly deferred without UI/docs overclaiming upload support.
- Server-side push notification boundary implemented or exactly blocked by missing credentials/secrets.
- Settlement copy/reference polish, hosted legal/support deployment, store/screenshot package, EAS/Maestro blocker evidence, release/build metadata, and real-device accessibility/i18n audit evidence.

## Out Of Scope For This Sprint

- Real payment processing, bKash merchant API, card/bank transfers, or in-app money movement.
- Production E2E auth bypass or any seeded-auth route outside local/preview/test builds.
- Regenerating or replacing the selected Baki app icon.
- Receipt OCR, recurring expenses, web app, admin dashboard, and friends-without-groups.
- Claiming manual real-device QA, hosted EAS/Maestro success, or native Bengali copy review unless those checks actually happen.

## Release-Blocking Items

- Required automated checks must pass: install, lint, typecheck, tests, i18n, DB checks, generated DB type checks, asset checks, E2E auth guard, release safety, aggregate check, and whitespace diff check.
- No direct client money-table writes.
- No service-role key in mobile code or env examples.
- Account deletion function deployment instructions and user-facing copy must remain accurate.
- Store-review docs must state that Baki records outside-app settlements and does not process payments.
- Any implemented group/expense/settlement mutation must be covered by DB or unit tests.

## Post-V1 / V1.1 Items

- Android production release after iOS closed beta.
- Hosted EAS/Maestro as a required release gate after a green preview-E2E run.
- Full push delivery if Expo push credentials or server-side secret setup block this sprint.
- Receipt upload if Supabase Storage policy design or offline upload behavior is not completed safely.
- Native Bengali copy review and real-device VoiceOver/TalkBack audit.
