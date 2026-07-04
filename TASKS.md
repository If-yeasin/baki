# Baki Beta Launch Production-Readiness Tracker

Updated: 2026-07-04

Status legend: **Implemented** exists in the repo and has automated coverage or
CI evidence. **Partial** exists but still has a beta/readiness gap. **Blocked**
needs an external secret, account, hosted environment, or live verification.
**Deferred** is intentionally outside this beta sprint.

## Implemented

- **Implemented:** Branch baseline includes PR #4 and PR #5 work on `main`; this
  sprint continues on `codex/beta-launch-production-readiness`, not on `main`.
- **Implemented:** Phone OTP/profile path, persisted session, Bengali/English
  i18n catalogs, language/theme preferences, sign-out, and account deletion
  client hook.
- **Implemented:** Create/join/list khatas plus group settings for rename, type
  change, archive, leave, safe delete, invite copy/share, and invite
  regeneration through server RPCs.
- **Implemented:** `create_group`, `create_expense`, `edit_expense`,
  `delete_expense`, and `create_settlement` are idempotent RPC replay paths.
- **Implemented:** Money-writing RPCs reject archived or soft-deleted groups
  before creating, editing, deleting, or settling ledger entries.
- **Implemented:** Expense add/edit/delete screens, offline queue replay, local
  cache updates, activity events, and DB/mobile tests exist.
- **Implemented:** Group and all-groups balance reads use server balance helpers
  with WatermelonDB fallback and integer-paisa math.
- **Implemented:** Settlement creation records outside-app payment only; bKash,
  Nagad, cash, and other methods do not process money inside Baki.
- **Implemented:** Activity views read real `activity_log` rows and support
  pull-to-refresh plus load-more pagination.
- **Implemented:** Settings includes Sync details, CSV ledger export,
  notification token/preferences screens, privacy/terms, support, and account
  deletion entry points.
- **Implemented:** Failed sync rows expose retry-all, retry-one, redacted debug
  copy, and guarded dismiss for permanent failures.
- **Implemented:** Sync error banners/toasts and Sentry event/breadcrumb payloads
  use redaction helpers for OTP/JWT/token/phone/MFS/payment-reference patterns.
- **Implemented:** CI runs install, local Supabase start/reset, lint, typecheck,
  generated Supabase type checks, tests, i18n parity, DB checks, asset checks,
  E2E auth guard, release safety, aggregate `pnpm check`, and
  `git diff --check`.
- **Implemented:** DB readiness and generated-type checks fail loudly in CI and
  release workflows via `BAKI_DB_TESTS_REQUIRED=true` and
  `BAKI_DB_TYPES_REQUIRED=true`, while local no-Docker/no-psql runs remain
  skippable for contributor ergonomics.
- **Implemented:** `scripts/check-release-safety.mjs` blocks service-role
  references in mobile code, direct mobile writes to ledger/group lifecycle
  tables, and unsafe benchmark-clone wording.

## Partial

- **Partial:** Supabase types include the expected current migration shape, but
  `packages/db/src/types.ts` still needs regeneration from a responsive
  Supabase environment for provenance.
- **Partial:** Receipt fields exist on expense RPCs, but receipt Storage bucket,
  policies, upload UI, offline handling, and tests are not implemented.
- **Partial:** Expo push token registration and notification preferences exist,
  and the UI distinguishes saved device tokens from delivery. Server-side
  notification delivery, queueing/dedupe, and push-secret documentation are not
  complete; see `docs/PUSH_DELIVERY_BOUNDARY.md`.
- **Partial:** Settlement flow records payments safely and offers simplified
  versus raw-balance views, but settlement note/reference polish remains.
- **Partial:** In-app privacy, terms, and support screens exist, and
  `docs-site/` prepares static store-review pages. Final hosted URLs are not
  deployed yet.
- **Partial:** Store metadata drafts and screenshot plan exist, but screenshot
  seed data/capture automation and final App Store/Play copy package need
  hardening.
- **Partial:** Preview E2E seed-auth is guarded for local/preview/test builds,
  but hosted EAS/Maestro is still optional until a visible run passes.
- **Partial:** Sentry runtime wiring and redaction tests exist, but release/build
  metadata tests need expansion.
- **Partial:** i18n parity is automated, key notification/sync/settlement
  controls have accessibility labels, and `docs/I18N_COPY_REVIEW.md` is ready.
  Native Bengali copy review and real-device accessibility audit are not claimed.

## Blocked / External

- **Blocked:** Live Supabase migration/type generation verification requires a
  responsive local or hosted Supabase environment plus appropriate project
  access. Do not use a mobile service-role key to unblock this.
- **Blocked:** `delete-account` Edge Function deployment must be run against the
  live Supabase project and verified with a reviewer-safe account.
- **Blocked:** Real push delivery needs server-side credentials/secrets for Expo
  push delivery or an approved worker/Edge Function environment.
- **Blocked:** App Store Connect submission needs real Apple Developer account
  values; `apps/mobile/eas.json` intentionally contains placeholders.
- **Blocked:** Google Play closed testing needs a Play Console account, closed
  track setup, tester list, privacy URL, and screenshots.
- **Blocked:** Hosted EAS/Maestro preview requires EAS/GitHub secrets and a
  seeded preview/test Supabase project. It remains optional until green.
- **Blocked:** Hosted legal/support/privacy URLs need `docs-site/` deployed to
  a real domain or accepted static-hosting destination before store submission.

## Deferred

- **Deferred:** Real payment processing, bKash merchant API, card/bank transfer,
  wallet/custody, lending, or any in-app money movement.
- **Deferred:** Receipt OCR, recurring expenses, friends without groups,
  comments, web app, and admin dashboard.
- **Deferred:** Public Android launch; Google Play closed testing readiness is
  prepared in this sprint, while production Android remains a later release
  track.
- **Deferred:** Native Bengali copy review and real-device VoiceOver/TalkBack
  audit are not claimed unless evidence is added.

## Required Automated Gate For This Sprint

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm i18n:check`
- [ ] `pnpm db:check`
- [ ] `pnpm db:types:check`
- [ ] `pnpm --filter mobile check:assets`
- [ ] `pnpm e2e:auth:check`
- [ ] `pnpm release:safety`
- [ ] `pnpm check`
- [ ] `git diff --check`
- [ ] CI passes on the PR.
- [ ] Main CI starts or passes after merge.

## Next Production-Readiness Work

1. Make DB/typegen integrity trustworthy: fresh migration reset, generated type
   provenance, no silent DB-test skips in CI, direct-write/RPC-grant assertions.
2. Implement receipt attachments safely, or add explicit deferred UI/docs that
   do not overclaim Storage support.
3. Add a server-side notification delivery boundary, or document the exact
   missing secrets while keeping token/preferences work safe.
4. Polish settlement mode/copy/reference behavior without implying Baki moves
   money.
5. Prepare hosted legal/support content, store metadata, screenshot automation
   or checklist, EAS/Maestro blocker summaries, observability redaction, and
   accessibility/i18n audit docs.
