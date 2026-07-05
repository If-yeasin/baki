# Overnight Security Watchdog

## 2026-07-05T11:15:48Z — overnight security/payments/monetization review

### Scope inspected

- Current working tree from `git status --short --branch`, `git diff --name-status`, staged diff check, and diff stat:
  - `.claude/agents/payments-engineer.md`
  - `.hermes/overnight/manager-heartbeat.md`
  - `.hermes/overnight/security-watchdog.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/ARCHITECTURE.md`
  - `scripts/check-release-safety.mjs`
- Branch remains `codex/beta-launch-production-readiness` ahead of origin by 2 commits; no staged files were present.
- Changed-file diffs reviewed. The active tracked diff continues to strengthen the ledger-only/non-custodial payment boundary by removing stale Stripe/merchant-checkout guidance, clarifying card/bank as not processed by Baki, and expanding release-safety deny rules.
- Relevant docs and controls spot-reviewed/searched: `docs/ARCHITECTURE.md`, `docs/MONETIZATION_READINESS.md`, `docs/DATA_MODEL.md`, `docs/PRIVACY_POLICY_DRAFT.md`, `docs/TERMS_DRAFT.md`, `docs/STORE/APP_STORE_CONNECT.md`, `docs/STORE/GOOGLE_PLAY.md`, `docs/PUSH_DELIVERY_BOUNDARY.md`, `packages/monetization/src/billing-boundary.ts`, `packages/monetization/src/analytics-events.ts`, `packages/payments/src/log.ts`, `apps/mobile/src/lib/sentry.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app.config.ts`, `apps/mobile/eas.json`, `apps/mobile/src/features/e2e/test-auth-guard.ts`, and `supabase/functions/delete-account/index.ts`.
- Ignored local bootstrap leftovers under `baki-bootstrap/` were also scanned after a nested `AGENTS.md` context surfaced during review; `git check-ignore -v` confirms the directory is ignored by `.gitignore:41` and `git ls-files -- baki-bootstrap` returns no tracked files.
- No schema/RLS migration changed in the current working tree. Docker, Supabase local stack, emulators, Metro, EAS builds, and other long-running services were not started.

### Lightweight checks and scans run

- `date -u '+%Y-%m-%dT%H:%M:%SZ'` — `2026-07-05T11:12:10Z`; final status timestamp `2026-07-05T11:15:48Z`.
- `git diff --check` — passed; no whitespace errors.
- `pnpm release:safety` — passed; release safety scan passed.
- `pnpm --filter @baki/monetization test` — passed, 3 files / 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 2 files / 15 tests.
- `pnpm --filter @baki/payments typecheck` — passed.
- `pnpm --filter @baki/payments lint` — passed.
- `pnpm i18n:check` — passed, 1 file / 3 tests.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 2 files / 10 tests.
- `pnpm typecheck` — passed for 6 Turbo tasks.
- `pnpm lint` — passed for 6 Turbo tasks; existing generated-file warning remains in `apps/mobile/.expo/types/router.d.ts` for an unused eslint-disable directive.
- Redacted pattern scans:
  - Tracked source scan found no mobile service-role references, direct mobile writes to `groups` / `group_members` / `expenses` / `expense_shares` / `settlements` / `activity_log`, JWT-looking literals, live Stripe key prefixes, AWS access-key prefixes, permissive RLS `using (true)` / `with check (true)` / disabled-RLS matches, local entitlement-grant booleans, or force-premium booleans.
  - Tracked source sensitive logging scan found no logger/Sentry/analytics call containing bKash/Nagad/MFS/OTP/token/JWT/bearer/phone/payment-reference/receipt terms.
  - Tracked stale payment-guidance scan found no active tracked matches outside the intentional deny regexes in `scripts/check-release-safety.mjs`.
  - Hardcoded UI-string delta check: no changed files under `apps/mobile`, `packages/ui`, or `packages/i18n` UI/catalog surfaces.
  - Ignored `baki-bootstrap/` scan found stale local guidance/docs still mentioning `Splitwise-style`, `payments-engineer` + Stripe, merchant API, deferred Stripe, and card/bank fallback wording; see finding below.

### Findings

#### LOW / local context hygiene — Ignored `baki-bootstrap/` copy still contains stale payment-processing guidance

- Paths:
  - `baki-bootstrap/AGENTS.md:9,34,48`
  - `baki-bootstrap/CLAUDE.md:13`
  - `baki-bootstrap/docs/ARCHITECTURE.md:27,29`
  - `baki-bootstrap/docs/PRD.md:39`
  - `baki-bootstrap/docs/ROADMAP.md:64`
- Evidence: the ignored bootstrap kit is not tracked and will not ship, but it still contains stale references to `Splitwise-style`, card/bank fallback positioning, Stripe ownership, bKash merchant API, and deferred Stripe payment tech. A subdirectory `AGENTS.md` context was surfaced when reading inside `baki-bootstrap/`, which means future local AI sessions that wander into that ignored tree could ingest stale payment guidance.
- Risk: low for release artifacts because `.gitignore:41` ignores `baki-bootstrap/` and `git ls-files -- baki-bootstrap` returns no tracked files. The risk is local/operator confusion and future AI-agent contamination around store-rule/payment-boundary decisions.
- Recommended fix: remove `baki-bootstrap/` from the working copy if it is no longer needed, or update/rename it as clearly archived historical material with the current non-custodial/IAP-server-verification payment boundary. Keep release-safety focused on tracked source, but avoid using this ignored tree as project context.

#### LOW / existing follow-up — Delete-account Edge Function log redaction remains narrower than mobile/analytics redaction

- Paths:
  - `supabase/functions/delete-account/index.ts:32-51`
  - `docs/DATA_MODEL.md:426-441`
  - Comparison controls: `apps/mobile/src/lib/sentry.ts:14-26`, `packages/monetization/src/analytics-events.ts:24-28`, `packages/payments/src/log.ts:17-26`
- Evidence: `logDeleteAccountError` still uses a local `redactPhoneLikeValues` helper that covers only contiguous Bangladesh phone-number formats before `console.error("delete-account failed", fields)`. Mobile Sentry and monetization analytics cover broader spaced/masked phone formats, bearer/JWT/token/OTP strings, payment-reference aliases, receipt aliases, and MFS aliases.
- Risk: current code does not log request headers or request bodies, so likelihood remains low. Future RPC/client error strings or expanded log context could still leak broader sensitive strings into Edge Function logs.
- Recommended fix: add a Deno-safe redaction helper/tests for the Edge Function covering phone/MFS formats, bearer/JWT/token/OTP strings, and payment-reference aliases; update `docs/DATA_MODEL.md` if the documented logging contract changes.

#### LOW / privacy hardening — Root error boundary still writes raw errors to the local console

- Path: `apps/mobile/app/_layout.tsx:85-87`
- Evidence: `componentDidCatch(error)` calls `console.error("[RootErrorBoundary]", error)` directly. The Sentry path has redaction, but this local-device console path does not pass through `redactSensitiveSentryText` / `redactSentryPayload`.
- Risk: low, because no specific sensitive payload was observed and the log is local. It remains a privacy footgun if a future thrown error contains phone numbers, MFS/payment references, tokens, or user notes.
- Recommended fix: remove this `console.error` in production or log only a scrubbed classification; rely on `Sentry.wrap` / `Sentry.captureException` with the existing `beforeSend` redaction for crash reporting.

#### INFO / non-blocking quality noise — Generated Expo router type still emits one lint warning

- Path: `apps/mobile/.expo/types/router.d.ts:1`
- Evidence: `pnpm lint` passed with the existing warning `Unused eslint-disable directive` in generated Expo router types.
- Risk: no direct security risk; this can obscure future lint regressions if warnings are ignored.
- Recommended fix: exclude/generated-ignore this file or regenerate/fix the generated artifact when convenient.

### Positive observations

- No high or medium findings in tracked release scope.
- No tracked changed file introduced purchase enablement, local entitlement grants, wallet/custody, settlement fees, webhook auto-confirmation, service-role client usage, direct mobile ledger-table writes, hardcoded UI-copy deltas, or user-facing payment-processing claims.
- Billing remains disabled by default; billing products keep `grantsEntitlementLocally: false`, and only `server_verified_iap` / `verified_invoice` are trusted entitlement sources.
- E2E seed-auth remains constrained to preview/dev/test surfaces by `apps/mobile/app.config.ts`, `apps/mobile/eas.json`, and `apps/mobile/src/features/e2e/test-auth-guard.ts`; targeted guard tests passed.
- Store/privacy/payment docs continue to frame Baki as a ledger that does not hold money, process payments, authorize transactions, or charge settlement fees.
- The current uncommitted `docs/ARCHITECTURE.md`, `.claude/agents/payments-engineer.md`, `AGENTS.md`, `CLAUDE.md`, and `scripts/check-release-safety.mjs` diffs strengthen the ledger-only/non-custodial payment boundary.

## 2026-07-05T10:08:40Z — overnight security/payments/monetization review

### Scope inspected

- Current working tree from `git status --short --branch`, `git diff --name-status`, staged diff check, and diff stat:
  - `.claude/agents/payments-engineer.md`
  - `.hermes/overnight/manager-heartbeat.md`
  - `.hermes/overnight/security-watchdog.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/ARCHITECTURE.md`
  - `scripts/check-release-safety.mjs`
- Branch remains `codex/beta-launch-production-readiness` ahead of origin by 2 commits; no staged files were present.
- Changed-file diffs reviewed. The active diff continues to strengthen the non-custodial payment boundary by removing stale Stripe/merchant-checkout language from agent guidance and architecture docs, clarifying cash/other as outside-app manual records, and adding release-safety deny rules for stale merchant/Stripe/card-bank fallback wording.
- Relevant docs and controls spot-reviewed/searched: `docs/ARCHITECTURE.md`, `docs/MONETIZATION_READINESS.md`, `docs/DATA_MODEL.md`, `docs/PRIVACY_POLICY_DRAFT.md`, `docs/TERMS_DRAFT.md`, `docs/STORE/APP_STORE_CONNECT.md`, `docs/STORE/GOOGLE_PLAY.md`, `packages/monetization/src/billing-boundary.ts`, `packages/monetization/src/analytics-events.ts`, `packages/payments/src/log.ts`, `apps/mobile/src/lib/sentry.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app.config.ts`, `apps/mobile/eas.json`, `apps/mobile/src/features/e2e/test-auth-guard.ts`, and `supabase/functions/delete-account/index.ts`.
- No schema/RLS migration changed in the current working tree. Docker, Supabase local stack, emulators, Metro, EAS builds, and other long-running services were not started.

### Lightweight checks and scans run

- `pnpm release:safety` — passed; release safety scan passed.
- `pnpm --filter @baki/monetization test` — passed, 3 files / 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 2 files / 15 tests.
- `pnpm --filter @baki/payments typecheck` — passed.
- `pnpm --filter @baki/payments lint` — passed.
- `pnpm i18n:check` — passed, 1 file / 3 tests.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 2 files / 10 tests.
- `pnpm lint` — passed; existing generated-file warning remains in `apps/mobile/.expo/types/router.d.ts` for an unused eslint-disable directive.
- `pnpm typecheck` — passed.
- `git diff --check` — passed; no whitespace errors.
- Pattern scans:
  - `apps/mobile`: no `service_role`, `SUPABASE_SERVICE_ROLE`, or `serviceRole` matches.
  - Repo-wide literal secret scan found no JWT-looking triples, live Stripe key prefixes, AWS access-key prefixes, or Supabase service-role env aliases.
  - `apps/mobile`: no same-line direct `.from(...).insert/update/delete/upsert` into `groups`, `group_members`, `expenses`, `expense_shares`, `settlements`, or `activity_log`; `pnpm release:safety` independently passed the multiline guard.
  - `packages/db`: no `disable row level security`, permissive `using (true)`, permissive `with check (true)`, or service-role matches.
  - `supabase`: only service-role hit is a README negative statement for `delete-account`; no permissive RLS/service-role code hit found.
  - Repo-wide entitlement bypass scan found no `grantsEntitlementLocally: true`, `isPremium = true`, or `isPro = true`; `manual_ui_toggle` and `client_purchase_result` matches remain only the typed boundary and tests asserting they are not store-verified.
  - Repo-wide same-line sensitive logging/Sentry/analytics scan found no logger call containing bKash/Nagad/MFS/OTP/token/JWT/bearer/phone/payment-reference/receipt terms.
  - Stale merchant/Stripe/card-bank guidance scan found only the deny regex inside `scripts/check-release-safety.mjs`; no active guidance/doc wording reintroduced it.
  - `docs` payment/store-risk matches were negative guardrail statements; no active wallet/custody, settlement-fee, webhook, in-app-money-movement, payment-processor, hold-money, or authorize-transaction product claim was found.
  - `packages/i18n/src` payment-boundary matches were limited to the settings terms line that says Baki does not process or hold money, plus the guard test forbidding wallet/custody settlement positioning.
  - E2E seed-auth remains constrained to preview/dev/test surfaces by `apps/mobile/app.config.ts`, `apps/mobile/eas.json`, and `apps/mobile/src/features/e2e/test-auth-guard.ts`; targeted guard tests passed.
  - Hardcoded UI-string delta check: no changed files under `apps/mobile`, `packages/ui`, or `packages/i18n` UI/catalog surfaces.

### Findings

#### LOW / existing follow-up — Delete-account Edge Function log redaction remains narrower than mobile/analytics redaction

- Paths:
  - `supabase/functions/delete-account/index.ts:32-51`
  - `docs/DATA_MODEL.md:426-441`
  - Comparison controls: `apps/mobile/src/lib/sentry.ts:14-26`, `packages/monetization/src/analytics-events.ts:24-28`, `packages/payments/src/log.ts:17-26`
- Evidence: `logDeleteAccountError` still uses a local `redactPhoneLikeValues` helper that covers only contiguous Bangladesh phone-number formats before `console.error("delete-account failed", fields)`. Mobile Sentry and monetization analytics cover broader spaced/masked phone formats, bearer/JWT/token/OTP strings, payment-reference aliases, receipt aliases, and MFS aliases.
- Risk: current code does not log request headers or request bodies, so likelihood remains low. Future RPC/client error strings or expanded log context could still leak broader sensitive strings into Edge Function logs.
- Recommended fix: add a Deno-safe redaction helper/tests for the Edge Function covering phone/MFS formats, bearer/JWT/token/OTP strings, and payment-reference aliases; update `docs/DATA_MODEL.md` if the documented logging contract changes.

#### LOW / privacy hardening — Root error boundary still writes raw errors to the local console

- Path: `apps/mobile/app/_layout.tsx:85-87`
- Evidence: `componentDidCatch(error)` calls `console.error("[RootErrorBoundary]", error)` directly. The Sentry path has redaction, but this local-device console path does not pass through `redactSensitiveSentryText` / `redactSentryPayload`.
- Risk: low, because no specific sensitive payload was observed and the log is local. It remains a privacy footgun if a future thrown error contains phone numbers, MFS/payment references, tokens, or user notes.
- Recommended fix: remove this `console.error` in production or log only a scrubbed classification; rely on `Sentry.wrap` / `Sentry.captureException` with the existing `beforeSend` redaction for crash reporting.

#### INFO / non-blocking quality noise — Generated Expo router type still emits one lint warning

- Path: `apps/mobile/.expo/types/router.d.ts:1`
- Evidence: `pnpm lint` passed with the existing warning `Unused eslint-disable directive` in generated Expo router types.
- Risk: no direct security risk; this can obscure future lint regressions if warnings are ignored.
- Recommended fix: exclude/generated-ignore this file or regenerate/fix the generated artifact when convenient.

### Positive observations

- No high or medium findings in this run.
- No changed file introduced purchase enablement, local entitlement grants, wallet/custody, settlement fees, webhook auto-confirmation, service-role client usage, direct mobile ledger-table writes, hardcoded UI-copy deltas, or user-facing payment-processing claims.
- Billing remains disabled by default; billing products keep `grantsEntitlementLocally: false`, and only `server_verified_iap` / `verified_invoice` are trusted entitlement sources.
- Store/privacy/payment docs continue to frame Baki as a ledger that does not hold money, process payments, authorize transactions, or charge settlement fees.
- The current uncommitted `docs/ARCHITECTURE.md`, `.claude/agents/payments-engineer.md`, `AGENTS.md`, `CLAUDE.md`, and `scripts/check-release-safety.mjs` diffs strengthen the ledger-only/non-custodial payment boundary.

## 2026-07-05T09:03:49Z — overnight security/payments/monetization review

### Scope inspected

- Current working tree from `git status --short --branch`, `git diff --name-status`, staged diff check, and diff stat:
  - `.claude/agents/payments-engineer.md`
  - `.hermes/overnight/manager-heartbeat.md`
  - `.hermes/overnight/security-watchdog.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/ARCHITECTURE.md`
  - `scripts/check-release-safety.mjs`
- Branch remains `codex/beta-launch-production-readiness` ahead of origin by 2 commits; no staged files were present.
- Changed-file diff reviewed. The active diff further narrows payment ownership to bKash/Nagad MFS handoff, explicitly says cash/other manual outside-app records are the fallback, removes stale Stripe/custom-checkout architecture wording, and expands release-safety checks for stale merchant/Stripe/card-bank guidance.
- Relevant docs and boundary controls spot-reviewed/searched: `docs/ARCHITECTURE.md`, `docs/MONETIZATION_READINESS.md`, store/privacy/payment docs, `packages/monetization/src/billing-boundary.ts`, `packages/monetization/src/analytics-events.ts`, `packages/payments/src/log.ts`, `apps/mobile/src/lib/sentry.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app.config.ts`, `supabase/functions/delete-account/index.ts`, and i18n settlement/terms copy.
- No schema/RLS migration changed in the current working tree. Docker, Supabase local stack, emulators, Metro, EAS builds, and other long-running services were not started.

### Lightweight checks and scans run

- `git diff --check` — passed; no whitespace errors.
- `pnpm release:safety` — passed; release safety scan passed.
- `pnpm --filter @baki/monetization test` — passed, 3 files / 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 2 files / 15 tests.
- `pnpm --filter @baki/payments typecheck` — passed.
- `pnpm --filter @baki/payments lint` — passed.
- `pnpm i18n:check` — passed, 1 file / 3 tests.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 2 files / 10 tests.
- `pnpm lint` — passed; existing generated-file warning remains in `apps/mobile/.expo/types/router.d.ts` for an unused eslint-disable directive.
- `pnpm typecheck` — passed.
- Pattern scans:
  - `apps/mobile`: no `service_role`, `SUPABASE_SERVICE_ROLE`, or `serviceRole` matches.
  - Repo-wide literal secret/JWT pattern scan found no JWT-looking triples, live Stripe key prefixes, AWS access-key prefixes, or service-role aliases.
  - `apps/mobile`: no same-line direct `.from(...).insert/update/delete/upsert` into `groups`, `group_members`, `expenses`, `expense_shares`, `settlements`, or `activity_log`; `pnpm release:safety` independently passed the multiline guard.
  - `packages/db` and `supabase`: no `disable row level security`, permissive `using (true)`, or permissive `with check (true)` matches.
  - Repo-wide entitlement bypass scan found no `grantsEntitlementLocally: true`, `isPremium = true`, `isPro = true`, trusted `manual_ui_toggle`, or trusted `client_purchase_result` pattern; entitlement-source matches remain the typed boundary and tests asserting client/manual sources are not store-verified.
  - Repo-wide same-line sensitive logging scan found no logger/Sentry/analytics call containing bKash/Nagad/MFS/OTP/token/JWT/bearer/phone/payment-reference/receipt terms.
  - Active `.claude/agents` guidance scan found no stale `Future: merchant API`, bKash merchant API, token checkout, Edge Function webhook, `settlements.external_ref`, or Stripe ownership wording.
  - `docs`: payment/store-risk matches were negative guardrail statements; no stale `Stripe v3`, `international users (deferred)`, card/bank fallback, wallet/custody, settlement-fee, webhook, or in-app-money-movement claim was found as active product positioning.
  - `packages/i18n/src`: wallet/custody/merchant/checkout/Stripe/settlement-fee scan only matched the settings terms line that says Baki does not process or hold money, plus the guard test that forbids wallet/custody settlement positioning.
  - Hardcoded UI-string delta check: no changed files under `apps/mobile`, `packages/ui`, or `packages/i18n` UI/catalog surfaces.

### Findings

#### LOW / existing follow-up — Delete-account Edge Function log redaction remains narrower than mobile/analytics redaction

- Paths:
  - `supabase/functions/delete-account/index.ts:32-51`
  - Comparison controls: `apps/mobile/src/lib/sentry.ts:14-26`, `packages/monetization/src/analytics-events.ts:24-28`, `packages/payments/src/log.ts:17-26`
- Evidence: `logDeleteAccountError` only applies `redactPhoneLikeValues`, which redacts contiguous Bangladesh phone-number formats before `console.error("delete-account failed", fields)`. Mobile Sentry and monetization analytics cover broader spaced/masked phone formats, bearer/JWT/token/OTP strings, payment-reference aliases, receipt aliases, and MFS aliases.
- Risk: current code does not log request headers or request bodies, so likelihood remains low. The path could still leak broader sensitive strings if future RPC errors or expanded context include tokens, payment references, or user-entered text.
- Recommended fix: add a Deno-safe redaction helper/tests for the Edge Function covering phone/MFS formats, bearer/JWT/token/OTP strings, and payment-reference aliases; update the data-model logging contract if needed.

#### LOW / privacy hardening — Root error boundary still writes raw errors to the local console

- Path: `apps/mobile/app/_layout.tsx:85-87`
- Evidence: `componentDidCatch(error)` calls `console.error("[RootErrorBoundary]", error)` directly. The existing Sentry redaction path is strong, but this raw local-device console path does not pass through `redactSensitiveSentryText` / `redactSentryPayload`.
- Risk: low, because this is local console logging and no specific sensitive payload was observed. It remains a privacy footgun if a future thrown error contains phone numbers, MFS/payment references, tokens, or user notes.
- Recommended fix: remove this `console.error` in production or log only a scrubbed classification; rely on `Sentry.wrap` / `Sentry.captureException` with the existing `beforeSend` redaction for crash reporting.

### Positive observations

- No high or medium findings in this run.
- No changed file introduced purchase enablement, local entitlement grants, wallet/custody, settlement fees, webhook auto-confirmation, service-role client usage, direct mobile ledger-table writes, hardcoded UI-copy deltas, or user-facing payment-processing claims.
- The previous card/bank guidance ambiguity is addressed by the current `AGENTS.md` diff, which now says cash/other manual outside-app records are the fallback and Baki does not process card or bank transfers.
- Billing remains disabled by default; billing products keep `grantsEntitlementLocally: false`, and only `server_verified_iap` / `verified_invoice` are trusted entitlement sources.
- E2E seed-auth remains production-gated by `apps/mobile/app.config.ts`; targeted guard tests passed.
- The current uncommitted `docs/ARCHITECTURE.md`, `.claude/agents/payments-engineer.md`, `AGENTS.md`, `CLAUDE.md`, and `scripts/check-release-safety.mjs` diffs strengthen the ledger-only/non-custodial boundary.
- Store/privacy/payment docs continue to frame Baki as a ledger that does not hold money, process payments, authorize transactions, or charge settlement fees.

## 2026-07-05T07:53:23Z — overnight security/payments/monetization review

### Scope inspected

- Current working tree from `git status --short --branch`, `git diff --name-status`, staged diff check, and diff stat:
  - `.claude/agents/payments-engineer.md`
  - `.hermes/overnight/manager-heartbeat.md`
  - `.hermes/overnight/security-watchdog.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/ARCHITECTURE.md`
  - `scripts/check-release-safety.mjs`
- Branch remains `codex/beta-launch-production-readiness` ahead of origin by 2 commits; no staged files were present.
- Changed-file diff reviewed. The active diff continues to narrow payment ownership to bKash/Nagad MFS handoff, replaces stale Stripe/custom-checkout architecture wording with future store-compliant IAP/server-verification guidance, and expands release-safety guards against stale merchant/Stripe guidance.
- Relevant docs and boundary controls spot-reviewed/searched: `docs/ARCHITECTURE.md`, `docs/MONETIZATION_READINESS.md`, docs-wide payment-boundary/store-risk text, `packages/monetization/src/billing-boundary.ts`, `packages/monetization/src/analytics-events.ts`, `apps/mobile/src/lib/sentry.ts`, `packages/payments/src/log.ts`, `supabase/functions/delete-account/index.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app.config.ts`, and settlement i18n copy.
- No schema/RLS migration changed in the current working tree. Docker, Supabase local stack, emulators, Metro, EAS builds, and other long-running services were not started.

### Lightweight checks and scans run

- `git diff --check` — passed; no whitespace errors.
- `pnpm release:safety` — passed; release safety scan passed.
- `pnpm --filter @baki/monetization test` — passed, 3 files / 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 2 files / 15 tests.
- `pnpm --filter @baki/payments typecheck` — passed.
- `pnpm --filter @baki/payments lint` — passed.
- `pnpm i18n:check` — passed, 1 file / 3 tests.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 2 files / 10 tests.
- `pnpm lint` — passed; existing generated-file warning remains in `apps/mobile/.expo/types/router.d.ts` for an unused eslint-disable directive.
- `pnpm typecheck` — passed.
- `pnpm exec prettier --check .claude/agents/payments-engineer.md AGENTS.md CLAUDE.md docs/ARCHITECTURE.md scripts/check-release-safety.mjs .hermes/overnight/security-watchdog.md .hermes/overnight/manager-heartbeat.md` — passed before this entry was written.
- Pattern scans:
  - `apps/mobile`: no `service_role`, `SUPABASE_SERVICE_ROLE`, or `serviceRole` matches.
  - `apps/mobile`: no same-line direct `.from(...).insert/update/delete/upsert` into `groups`, `group_members`, `expenses`, `expense_shares`, `settlements`, or `activity_log`; `pnpm release:safety` independently passed the multiline guard.
  - Repo-wide entitlement bypass scan found no `grantsEntitlementLocally: true`, `isPremium = true`, `isPro = true`, trusted `manual_ui_toggle`, or trusted `client_purchase_result` pattern.
  - `packages/db`: no `disable row level security`, permissive `using (true)`, permissive `with check (true)`, or service-role matches.
  - `apps/mobile`: no same-line sensitive logging/Sentry matches involving bKash/Nagad/MFS/OTP/token/JWT/bearer/phone/payment-reference/receipt terms.
  - Active `.claude/agents` guidance scan found no stale `Future: merchant API`, bKash merchant API, token checkout, Edge Function webhook, `settlements.external_ref`, or Stripe ownership wording.
  - `docs`: stale deferred `Stripe v3` / `international users (deferred)` wording was absent; merchant/wallet/custody/settlement-fee/webhook/in-app-money-movement matches were negative guardrail statements.
  - `packages/i18n/src`: wallet/custody/merchant/checkout/Stripe/settlement-fee scan only matched the settings terms line that says Baki does not process or hold money, plus the guard test that forbids wallet/custody settlement positioning.
  - Card/bank wording scan found only store/privacy negative statements, `AGENTS.md:37`, payment-engineer's “no processing” line, and manual “Other” settlement copy in `packages/i18n/src/en.json:350-351` / `packages/i18n/src/bn.json:350-351`.

### Findings

#### LOW / existing follow-up — Delete-account Edge Function log redaction remains narrower than mobile/analytics redaction

- Paths:
  - `supabase/functions/delete-account/index.ts:32-51`
  - Comparison controls: `apps/mobile/src/lib/sentry.ts:14-26`, `packages/monetization/src/analytics-events.ts:24-28`, `packages/payments/src/log.ts:17-26`
- Evidence: `logDeleteAccountError` only applies `redactPhoneLikeValues`, which redacts contiguous Bangladesh phone-number formats before `console.error("delete-account failed", fields)`. Mobile Sentry and monetization analytics cover broader spaced/masked phone formats, bearer/JWT/token/OTP strings, payment-reference aliases, receipt aliases, and MFS aliases.
- Risk: current code does not log request headers or request bodies, so likelihood remains low. The path could still leak broader sensitive strings if future RPC errors or expanded context include tokens, payment references, or user-entered text.
- Recommended fix: add a Deno-safe redaction helper/tests for the Edge Function covering phone/MFS formats, bearer/JWT/token/OTP strings, and payment-reference aliases; update the data-model logging contract if needed.

#### LOW / privacy hardening — Root error boundary still writes raw errors to the local console

- Path: `apps/mobile/app/_layout.tsx:85-87`
- Evidence: `componentDidCatch(error)` calls `console.error("[RootErrorBoundary]", error)` directly. The existing Sentry redaction path is strong, but this raw local-device console path does not pass through `redactSensitiveSentryText` / `redactSentryPayload`.
- Risk: low, because this is local console logging and no specific sensitive payload was observed. It remains a privacy footgun if a future thrown error contains phone numbers, MFS/payment references, tokens, or user notes.
- Recommended fix: remove this `console.error` in production or log only a scrubbed classification; rely on `Sentry.wrap` / `Sentry.captureException` with the existing `beforeSend` redaction for crash reporting.

#### INFO / store-copy clarity to monitor — Card/bank terms appear only as manual record wording, but active guidance could be clearer

- Paths:
  - `AGENTS.md:37`
  - `packages/i18n/src/en.json:350-351`
  - `packages/i18n/src/bn.json:350-351`
  - Counter-control: `.claude/agents/payments-engineer.md:16-21`
- Evidence: active principles still say “Card/bank transfer is a fallback,” and the “Other” settlement method says users can record bank/card/other payments. The current payment-engineer guardrail correctly forbids card or bank transfer processing, and the i18n copy uses “Record” / “লিখে রাখো,” not processing or checkout language.
- Risk: not an implemented payment path, but store reviewers or future agents could misread “fallback” as card/bank transfer support instead of outside-app manual ledger recording.
- Recommended fix: when editing guidance/copy, clarify “manual outside-app record only; no card/bank processing,” or replace “card/bank transfer is a fallback” with “cash/other manual record is the fallback.”

### Positive observations

- No high or medium findings in this run.
- No changed file introduced purchase enablement, local entitlement grants, wallet/custody, settlement fees, webhook auto-confirmation, service-role client usage, direct mobile ledger-table writes, hardcoded UI-copy deltas, or user-facing payment-processing claims.
- Billing remains disabled by default; billing products keep `grantsEntitlementLocally: false`, and only `server_verified_iap` / `verified_invoice` are trusted entitlement sources.
- The current uncommitted `docs/ARCHITECTURE.md`, `.claude/agents/payments-engineer.md`, `AGENTS.md`, `CLAUDE.md`, and `scripts/check-release-safety.mjs` diffs strengthen the ledger-only/non-custodial boundary.
- Store/privacy/payment docs continue to frame Baki as a ledger that does not hold money, process payments, authorize transactions, or charge settlement fees.

## 2026-07-05T06:46:41Z — overnight security/payments/monetization review

### Scope inspected

- Current working tree from `git status --short`, `git diff --name-only`, and staged diff check:
  - `.claude/agents/payments-engineer.md`
  - `.hermes/overnight/manager-heartbeat.md`
  - `.hermes/overnight/security-watchdog.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/ARCHITECTURE.md`
  - `scripts/check-release-safety.mjs`
- Branch recent commits reviewed: `84173c6 fix: harden payment redaction and handoff guardrails`, `5190f07 feat: prepare monetization and release readiness`, `e352665 Stabilize DB readiness CI tests`, `d7f71f1 Match generated Supabase type ordering`, `be83ee2 Print stale Supabase type diffs`.
- Required project docs were re-read/spot-reviewed before this write, including the AGENTS-listed docs plus monetization, push boundary, store, privacy, terms, support, copy-review, screenshot, release-candidate, and automated-gate docs.
- Changed guidance/release-safety files were reviewed. The active diff keeps `payments-engineer` scoped to bKash/Nagad MFS handoff and replaces stale Stripe/custom-checkout architecture wording with future store-compliant IAP/server-verification guidance.
- Related controls inspected: `packages/monetization/src/billing-boundary.ts`, `packages/monetization/src/analytics-events.ts`, `apps/mobile/src/lib/sentry.ts`, `packages/payments/src/log.ts`, `packages/i18n/src/i18n-parity.test.ts`, `apps/mobile/app.config.ts`, `supabase/functions/delete-account/index.ts`, and `apps/mobile/app/_layout.tsx`.
- No schema/RLS migration changed in the current working tree. Docker, Supabase local stack, emulators, Metro, EAS builds, and other long-running services were not started.

### Lightweight checks and scans run

- `pnpm release:safety` — passed; release safety scan passed.
- `pnpm --filter @baki/monetization test` — passed, 3 files / 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 2 files / 15 tests.
- `pnpm --filter @baki/payments typecheck` — passed.
- `pnpm --filter @baki/payments lint` — passed.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 2 files / 10 tests.
- `pnpm i18n:check` — passed, 1 file / 3 tests.
- `pnpm exec prettier --check .claude/agents/payments-engineer.md AGENTS.md CLAUDE.md docs/ARCHITECTURE.md scripts/check-release-safety.mjs .hermes/overnight/security-watchdog.md .hermes/overnight/manager-heartbeat.md` — passed before this entry was written.
- `git diff --check` — passed; no whitespace errors.
- Pattern scans:
  - `apps/mobile`: no `service_role`, `SUPABASE_SERVICE_ROLE`, or service-role wording matches.
  - `apps/mobile`: no direct `.from(...).insert/update/delete/upsert` into `groups`, `group_members`, `expenses`, `expense_shares`, `settlements`, or `activity_log`.
  - `apps/mobile`: no same-line sensitive logging/Sentry matches involving bKash/Nagad/MFS/OTP/token/JWT/bearer/phone/payment-reference/receipt terms.
  - Repo-wide entitlement bypass scan found no `grantsEntitlementLocally: true`, `isPremium = true`, `isPro = true`, or trusted client/manual entitlement grant pattern.
  - `packages/i18n/src`: wallet/custody/merchant/checkout/Stripe/settlement-fee scan only matched the guard test that forbids settlement wallet/custody positioning.
  - `packages/db`: no `disable row level security`, permissive `using (true)`, permissive `with check (true)`, or service-role matches.
  - Active guidance/docs scan found no stale `Future: merchant API`, token checkout, Edge Function webhook, deferred Stripe v3, or international-users-deferred payment wording.

### Findings

#### LOW / existing follow-up — Delete-account Edge Function log redaction remains narrower than mobile/analytics redaction

- Paths:
  - `supabase/functions/delete-account/index.ts:32-51`
  - `docs/DATA_MODEL.md:426-441`
  - Comparison controls: `apps/mobile/src/lib/sentry.ts:14-26`, `packages/monetization/src/analytics-events.ts:24-28`, `packages/payments/src/log.ts:17-26`
- Evidence: `logDeleteAccountError` only applies `redactPhoneLikeValues`, which redacts contiguous Bangladesh phone-number formats before `console.error("delete-account failed", fields)`. Mobile Sentry and monetization analytics cover broader spaced/masked phone formats, bearer/JWT/token/OTP strings, payment-reference aliases, receipt aliases, and MFS aliases.
- Risk: current code does not log request headers or request bodies, so likelihood is low. The path could still leak broader sensitive strings if future RPC errors or expanded context include tokens, payment references, or user-entered text.
- Recommended fix: add a Deno-safe redaction helper/tests for the Edge Function covering phone/MFS formats, bearer/JWT/token/OTP strings, and payment-reference aliases; update `docs/DATA_MODEL.md` so the documented logging contract matches the implementation.

#### LOW / privacy hardening — Root error boundary still writes raw errors to the local console

- Path: `apps/mobile/app/_layout.tsx:85-87`
- Evidence: `componentDidCatch(error)` calls `console.error("[RootErrorBoundary]", error)` directly. The existing Sentry redaction path is strong, but this raw local-device console path does not pass through `redactSensitiveSentryText` / `redactSentryPayload`.
- Risk: low, because this is local console logging and no specific sensitive payload was observed. It remains a privacy footgun if a future thrown error contains phone numbers, MFS/payment references, tokens, or user notes.
- Recommended fix: remove this `console.error` in production or log only a scrubbed classification; rely on `Sentry.wrap` / `Sentry.captureException` with the existing `beforeSend` redaction for crash reporting.

### Positive observations

- No high/medium findings in this run.
- No changed file introduced purchase enablement, local entitlement grants, wallet/custody, settlement fees, webhook auto-confirmation, service-role client usage, direct mobile ledger-table writes, hardcoded UI-copy deltas, or user-facing payment-processing claims.
- Billing remains disabled by default; billing products keep `grantsEntitlementLocally: false`, and only `server_verified_iap` / `verified_invoice` are trusted entitlement sources.
- E2E seed-auth remains production-gated by `app.config.ts`; targeted guard tests passed.
- Store/privacy/payment docs continue to frame Baki as a ledger that does not hold money, process payments, authorize transactions, or charge settlement fees.

## 2026-07-05T05:41:50Z — overnight security/payments/monetization review

### Scope inspected

- Current working tree from `git status --short --branch`, `git diff --name-status`, and staged diff check:
  - `.claude/agents/payments-engineer.md`
  - `.hermes/overnight/manager-heartbeat.md`
  - `.hermes/overnight/security-watchdog.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/ARCHITECTURE.md`
  - `scripts/check-release-safety.mjs`
- Branch remains `codex/beta-launch-production-readiness` ahead of origin by 2 commits; no staged files were present.
- Changed guidance/release-safety diff was reviewed. `docs/ARCHITECTURE.md` now replaces stale deferred Stripe wording with store-compliant mobile subscription billing guidance: no billing is implemented; future paid entitlements require App Store/Play-compliant IAP plus server verification and must stay separate from settlement handoff/payment processing.
- Related payment/privacy/monetization boundaries spot-reviewed: `docs/MONETIZATION_READINESS.md`, `docs/DATA_MODEL.md`, `packages/monetization/src/billing-boundary.ts`, `packages/monetization/src/analytics-events.ts`, `apps/mobile/src/lib/sentry.ts`, `packages/payments/src/log.ts`, `supabase/functions/delete-account/index.ts`, and `apps/mobile/app/_layout.tsx`.
- No changed schema/RLS migrations were present. Docker, Supabase local stack, emulators, Metro, and EAS builds were not started.

### Lightweight checks and scans run

- `pnpm release:safety` — passed.
- `pnpm --filter @baki/monetization test` — passed, 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 15 tests.
- `pnpm --filter @baki/payments typecheck` — passed.
- `pnpm --filter @baki/payments lint` — passed.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 10 tests.
- `pnpm i18n:check` — passed, 3 tests.
- `pnpm exec prettier --check .claude/agents/payments-engineer.md AGENTS.md CLAUDE.md docs/ARCHITECTURE.md scripts/check-release-safety.mjs .hermes/overnight/security-watchdog.md .hermes/overnight/manager-heartbeat.md` — passed before this entry was written.
- `git diff --check` — passed; no whitespace errors.
- Pattern scans:
  - `apps/mobile`: no `service_role` / `SUPABASE_SERVICE_ROLE` references.
  - `apps/mobile`: no direct `.from(...).insert/update/delete/upsert` into `groups`, `group_members`, `expenses`, `expense_shares`, `settlements`, or `activity_log`; `pnpm release:safety` independently passed its multiline guard.
  - `packages/db`: no `disable row level security`, permissive `using (true)`, permissive `with check (true)`, or service-role matches.
  - Entitlement scan found no `grantsEntitlementLocally: true`; the only `client_purchase_result` / `manual_ui_toggle` matches are the boundary type and tests asserting those sources are not store-verified.
  - `packages/i18n/src`: no wallet/custody/merchant/checkout/Stripe/settlement-fee claim; matches are positive privacy/terms copy stating Baki tracks ledgers and does not process or hold money, plus the i18n guard test.
  - Hardcoded UI-string delta check: no changed files under `apps/mobile`, `packages/ui`, or `packages/i18n` UI/catalog surfaces; `pnpm i18n:check` passed.
  - `docs`: payment/store-risk terms align with ledger-only positioning; `docs/ARCHITECTURE.md` no longer lists deferred Stripe/custom checkout as payment tech.
  - Logging review found Sentry/payments analytics redaction in place for MFS numbers, tokens/JWTs, payment-reference aliases, receipt aliases, and push tokens; no raw MFS console/log statement was found in changed files.

### Findings

#### LOW / existing follow-up — Delete-account Edge Function log redaction remains narrower than mobile/analytics redaction

- Paths:
  - `supabase/functions/delete-account/index.ts:32-51`
  - `docs/DATA_MODEL.md:426-441`
  - Comparison controls: `apps/mobile/src/lib/sentry.ts:14-26`, `packages/payments/src/log.ts:17-26`, `packages/monetization/src/analytics-events.ts:24-28`
- Evidence: `logDeleteAccountError` redacts only contiguous Bangladesh phone formats before `console.error("delete-account failed", fields)`. The data-model doc still says raw errors are logged but phone/MFS values are masked via `maskMfsNumber`; the implementation actually uses a local helper and does not cover spaced/masked phone formats, bearer/JWT/token/OTP strings, or payment-reference aliases covered by mobile Sentry and monetization analytics.
- Risk: current code does not log request headers or request body, so likelihood remains low. Future RPC/client error strings or expanded log context could leak broader sensitive values into Supabase Edge Function logs unless this path receives the same redaction coverage.
- Recommended fix: add a small Deno-safe Edge Function redaction helper and tests for phone/MFS formats, bearer/JWT/token/OTP strings, and payment-reference aliases; update `docs/DATA_MODEL.md` so the documented logging contract matches the implementation.

#### LOW / privacy hardening — Root error boundary still writes raw errors to the local console

- Path: `apps/mobile/app/_layout.tsx:85-87`
- Evidence: `componentDidCatch(error)` calls `console.error("[RootErrorBoundary]", error)` directly. This is not a changed-file regression and no specific MFS/OTP/token payload was observed, but raw thrown errors are not passed through the existing `redactSensitiveSentryText` / `redactSentryPayload` scrubber before reaching device logs.
- Risk: low, because normal settlement and Supabase paths capture errors through Sentry with redaction and this console line is local-device logging. It is still a privacy footgun if a future thrown error includes phone numbers, payment references, tokens, or user-entered notes.
- Recommended fix: remove the raw `console.error` in production, or log only a scrubbed message/classification; rely on `Sentry.wrap`/`Sentry.captureException` with the existing `beforeSend` redaction for crash reporting.

### Positive observations

- The prior architecture-doc Stripe/custom-checkout ambiguity is addressed by the current `docs/ARCHITECTURE.md` diff, and `scripts/check-release-safety.mjs` now guards against reintroducing that stale canonical wording.
- Active agent guidance now scopes `payments-engineer` to bKash/Nagad handoff, settlement UX, and the non-custodial boundary; no active agent prompt now claims Stripe, merchant checkout, token checkout, webhooks, settlement fees, wallet/custody, or in-app money movement ownership.
- No changed file introduced purchase enablement, local entitlement grants, wallet/custody, settlement fees, webhook auto-confirmation, service-role client usage, direct mobile ledger-table writes, or new user-facing payment-processing claims.
- Billing remains disabled by default; billing products keep `grantsEntitlementLocally: false`, and only `server_verified_iap` / `verified_invoice` are trusted entitlement sources.
- Store/privacy/payment positioning remains ledger-only: Baki does not hold money, process payments, authorize transactions, or charge settlement fees.

## 2026-07-05T04:33:37Z — overnight security/payments/monetization review

### Scope inspected

- Current working tree from `git status --short --branch`, `git diff --name-status`, and `git diff --stat`:
  - `.claude/agents/payments-engineer.md`
  - `.hermes/overnight/manager-heartbeat.md`
  - `.hermes/overnight/security-watchdog.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `scripts/check-release-safety.mjs`
- Branch remains `codex/beta-launch-production-readiness` ahead of origin by 2 commits; no staged files were present.
- Changed guidance/release-safety files were re-read, along with monetization/payment/privacy boundary controls in `docs/MONETIZATION_READINESS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `packages/monetization/src/billing-boundary.ts`, `apps/mobile/src/lib/sentry.ts`, `packages/payments/src/log.ts`, and `supabase/functions/delete-account/index.ts`.
- No changed schema/RLS migrations were present. Docker, Supabase local stack, emulators, Metro, and EAS builds were not started.

### Lightweight checks and scans run

- `pnpm release:safety` — passed.
- `pnpm --filter @baki/monetization test` — passed, 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 15 tests.
- `pnpm --filter @baki/payments typecheck` — passed.
- `pnpm --filter @baki/payments lint` — passed.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 10 tests.
- `pnpm i18n:check` — passed, 3 tests.
- `pnpm exec prettier --check .claude/agents/payments-engineer.md AGENTS.md CLAUDE.md scripts/check-release-safety.mjs .hermes/overnight/manager-heartbeat.md .hermes/overnight/security-watchdog.md` — passed before this entry was written.
- `git diff --check` — passed; no whitespace errors.
- Pattern scans:
  - `apps/mobile`: no `service_role` / `SUPABASE_SERVICE_ROLE` references.
  - `apps/mobile`: no direct `.from(...).insert/update/delete/upsert` into `groups`, `group_members`, `expenses`, `expense_shares`, `settlements`, or `activity_log`.
  - Sensitive logging proximity scan found no `console.*` / logger / Sentry call near MFS, OTP, token, JWT, payment-reference, transaction-id, receipt, or phone terms.
  - Entitlement scan found no `grantsEntitlementLocally: true`; `DISABLED_BILLING_CLIENT` remains exported and tests still assert `client_purchase_result` / `manual_ui_toggle` are not trusted.
  - `packages/i18n/src`: no active settlement-copy `wallet`/custody/merchant/Stripe/settlement-fee matches; the only user-facing payment-boundary hit is the settings terms line stating Baki opens handoffs but does not process or hold money.

### Findings

#### LOW — Architecture doc still names Stripe as deferred payment tech

- Paths:
  - `docs/ARCHITECTURE.md:29-33`
  - Comparison controls: `docs/MONETIZATION_READINESS.md:30-40`, `AGENTS.md:47-52`, `CLAUDE.md:11-15`, `.claude/agents/payments-engineer.md:16-22`, `scripts/check-release-safety.mjs:25-31`
- Evidence: active agent guidance and release-safety checks now correctly keep `payments-engineer` scoped to non-custodial bKash/Nagad MFS handoff. `docs/MONETIZATION_READINESS.md` also forbids consumer digital subscriptions through Stripe/custom mobile checkout. However, `docs/ARCHITECTURE.md` still lists `Stripe — v3 only, for international users (deferred)` under `### Payments`.
- Risk: no implemented code path was found, but this stale architecture note can confuse future monetization/store-review work and may be read as a planned custom mobile checkout or payment-processing path.
- Recommended fix: replace the Stripe bullet with an App Store/Play-safe billing note such as “mobile subscription billing is not implemented; any future paid entitlements require store-compliant IAP plus server verification,” or move any future international/team invoicing concept into a separate deferred business-billing section with an explicit “not mobile checkout / not settlement processing” guard. Consider extending `scripts/check-release-safety.mjs` to scan canonical payment architecture docs for stale Stripe/custom-checkout wording.

#### LOW / open follow-up — Delete-account Edge Function log redaction remains narrower than mobile/analytics redaction

- Paths:
  - `supabase/functions/delete-account/index.ts:32-51`
  - `docs/DATA_MODEL.md:426-441`
  - Comparison controls: `apps/mobile/src/lib/sentry.ts:14-26`, `packages/payments/src/log.ts:17-26`, `packages/monetization/src/analytics-events.ts:24-28`
- Evidence: `logDeleteAccountError` redacts only contiguous Bangladesh phone formats in error strings before `console.error("delete-account failed", fields)`. `docs/DATA_MODEL.md` still describes “raw error” logging with `maskMfsNumber`, while the implementation uses a local `redactPhoneLikeValues` helper and does not cover spaced/masked phone formats, bearer/JWT/token/OTP strings, or payment-reference aliases now covered by mobile Sentry and monetization analytics.
- Risk: current code does not log request headers or body, so likelihood remains low. Future RPC/client error strings or expanded log context could leak broader sensitive values into Supabase Edge Function logs unless this path gets the same redaction coverage.
- Recommended fix: add a small Deno-safe Edge Function redaction helper and tests for phone/MFS formats, bearer/JWT/token/OTP strings, and payment-reference aliases; update `docs/DATA_MODEL.md` so the documented logging contract matches the actual implementation.

### Positive observations

- No changed file introduced purchase enablement, local entitlement grants, wallet/custody, settlement fees, webhook auto-confirmation, service-role client usage, direct mobile ledger-table writes, or new user-facing payment-processing claims.
- The active guidance diff narrows payments ownership away from Stripe/merchant APIs and toward non-custodial MFS handoff only.
- `scripts/check-release-safety.mjs` passed and now blocks stale active-agent merchant/Stripe/token-checkout/webhook guidance.
- Billing remains disabled by default; billing products keep `grantsEntitlementLocally: false`, and only `server_verified_iap` / `verified_invoice` are trusted entitlement sources.
- Store/privacy/payment positioning remains ledger-only: Baki does not hold money, process payments, or authorize transactions.

## 2026-07-05T03:29:21Z — overnight security/payments/monetization review

### Scope inspected

- Current working tree from `git status --short --branch` / `git diff --name-status`:
  - `.claude/agents/payments-engineer.md`
  - `.hermes/overnight/manager-heartbeat.md`
  - `.hermes/overnight/security-watchdog.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `scripts/check-release-safety.mjs`
- Changed-file diff reviewed for payment-boundary and release-safety changes. No staged files; branch `codex/beta-launch-production-readiness` is ahead of origin by 2 commits.
- Canonical docs re-read/spot-reviewed for store/payment/privacy alignment: `docs/PRD.md`, `docs/FEATURES.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DESIGN_SYSTEM.md`, `docs/BANGLADESH_CONTEXT.md`, `docs/ROADMAP.md`, `docs/SETUP.md`, `docs/BRAND.md`, `docs/OFFLINE_SYNC.md`, `docs/RELEASE_NOTES.md`, `docs/MONETIZATION_READINESS.md`, privacy/terms drafts, store drafts, release-candidate gap map, and `TASKS.md`.
- Related boundary files spot-reviewed: `packages/monetization/src/billing-boundary.ts`, `packages/monetization/src/analytics-events.ts`, `packages/payments/src/log.ts`, `apps/mobile/src/lib/sentry.ts`, and `supabase/functions/delete-account/index.ts`.
- Docker/Supabase local stack, emulators, Metro, and EAS builds were not started.

### Lightweight checks and scans run

- `pnpm release:safety` — passed.
- `pnpm --filter @baki/monetization test` — passed, 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 15 tests.
- `pnpm --filter @baki/payments typecheck` — passed.
- `pnpm --filter @baki/payments lint` — passed.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 10 tests.
- `pnpm i18n:check` — passed, 3 tests.
- `pnpm exec prettier --check .claude/agents/payments-engineer.md AGENTS.md CLAUDE.md scripts/check-release-safety.mjs .hermes/overnight/manager-heartbeat.md .hermes/overnight/security-watchdog.md` — passed.
- `git diff --check` — passed; no whitespace errors.
- Pattern scans:
  - `apps/mobile`: no `service_role` / `SUPABASE_SERVICE_ROLE` references.
  - `apps/mobile`: no direct `.from(...).insert/update/delete/upsert` into `groups`, `group_members`, `expenses`, `expense_shares`, `settlements`, or `activity_log`.
  - `apps/mobile` and `packages/i18n/src/*.json`: no wallet/payment-processor/merchant-checkout/settlement-fee user-facing copy matches.
  - Hardcoded UI-string delta scan: no changed files under `apps/mobile`, `packages/ui`, or `packages/i18n`, so no new UI literals were introduced by this working-tree diff.
  - Sensitive logging proximity scan found no `console.*` / Sentry call near MFS, OTP, token, JWT, payment-reference, transaction-id, or phone terms.
  - Entitlement scan found no `grantsEntitlementLocally: true`; `DISABLED_BILLING_CLIENT` remains the exported billing client and only `server_verified_iap` / `verified_invoice` are trusted entitlement sources.

### Findings

#### LOW — Architecture doc still names Stripe as deferred payment tech

- Paths:
  - `docs/ARCHITECTURE.md:29-33`
  - Comparison controls: `docs/MONETIZATION_READINESS.md:30-36`, `AGENTS.md:47-52`, `CLAUDE.md:11-15`, `.claude/agents/payments-engineer.md:16-22`
- Evidence: active agent guidance now correctly scopes `payments-engineer` to bKash/Nagad MFS handoff and the non-custodial boundary, and `docs/MONETIZATION_READINESS.md` says not to put consumer digital subscriptions through Stripe/custom mobile checkout. `docs/ARCHITECTURE.md` still lists `Stripe — v3 only, for international users (deferred)` under `### Payments`.
- Risk: not an implemented code path and not a current changed-file regression, but it creates store-rule/product ambiguity: future AI-agent work or reviewer prep could interpret Stripe as planned in-app payment processing or a custom checkout path, conflicting with the current ledger-only and store-verified-billing boundaries.
- Recommended fix: replace the Stripe bullet with a monetization-safe note such as “Mobile subscription billing is not implemented; future paid entitlements require App Store/Play-compliant IAP plus server verification,” or move any future international/team invoicing idea to a separate deferred business-billing section with an explicit “not mobile checkout / not settlement processing” guard. Consider extending `scripts/check-release-safety.mjs` to flag stale Stripe/custom-checkout wording in canonical payment architecture docs, not only active agent guidance.

#### LOW / open follow-up — Delete-account Edge Function log redaction remains narrower than mobile/analytics redaction

- Paths:
  - `supabase/functions/delete-account/index.ts:32-51`
  - `docs/DATA_MODEL.md:441`
  - Comparison controls: `apps/mobile/src/lib/sentry.ts:14-26`, `packages/payments/src/log.ts:17-26`, `packages/monetization/src/analytics-events.ts:24-28`
- Evidence: `logDeleteAccountError` still only redacts contiguous Bangladesh phone formats in error messages before `console.error("delete-account failed", fields)`, while mobile Sentry and monetization analytics cover broader phone/MFS formats, bearer/JWT/token/OTP strings, and payment-reference aliases.
- Risk: current code does not log request headers/body, so likelihood remains low. Future RPC/client error strings or extra log context could leak sensitive values into Supabase Edge Function logs unless this path gets the same redaction coverage.
- Recommended fix: add a small Deno-safe Edge Function redaction helper and tests for phone/MFS formats, JWT/bearer/token/OTP strings, and payment-reference aliases; update `docs/DATA_MODEL.md` if the implementation intentionally stays local/minimal rather than using `maskMfsNumber`.

### Positive observations

- The current uncommitted guidance/release-safety diff narrows payment ownership away from Stripe/merchant APIs and toward non-custodial MFS handoff only.
- `scripts/check-release-safety.mjs` now blocks stale active-agent merchant/Stripe/token-checkout/webhook guidance; the scan passed.
- Billing remains disabled by default; billing product metadata keeps `grantsEntitlementLocally: false` and client/manual entitlement sources remain untrusted.
- No changed file introduced purchase enablement, wallet/custody, settlement fees, webhook auto-confirmation, service-role client usage, direct mobile ledger-table writes, or new user-facing payment-processing claims.
- Store drafts continue to state Baki does not hold money, process payments, or authorize transactions.

## 2026-07-05T02:23:55Z — overnight security/payments/monetization review

### Scope inspected

- Current working tree from `git status --short` / `git diff --name-status`:
  - `.claude/agents/payments-engineer.md`
  - `.hermes/overnight/manager-heartbeat.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `scripts/check-release-safety.mjs`
- Canonical docs re-read before review: `docs/PRD.md`, `docs/FEATURES.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DESIGN_SYSTEM.md`, `docs/BANGLADESH_CONTEXT.md`, `docs/ROADMAP.md`, `docs/SETUP.md`, `docs/BRAND.md`, `docs/OFFLINE_SYNC.md`, `docs/RELEASE_NOTES.md`, plus `docs/MONETIZATION_READINESS.md` for billing/payment guardrails.
- Related boundary files spot-reviewed: `apps/mobile/app.config.ts`, `apps/mobile/src/features/e2e/test-auth-guard.ts`, `apps/mobile/src/lib/sentry.ts`, `packages/monetization/src/billing-boundary.ts`, `packages/monetization/src/analytics-events.ts`, `packages/payments/src/log.ts`, and `supabase/functions/delete-account/index.ts`.
- No changed schema/RLS migrations were present. Docker/Supabase local stack, emulators, Metro, and EAS builds were not started.

### Lightweight checks and scans run

- `git diff --check` — passed; no whitespace errors.
- `pnpm release:safety` — passed; release safety scan passed.
- `pnpm --filter @baki/monetization test` — passed, 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 15 tests.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 10 tests.
- `pnpm i18n:check` — passed, 3 tests.
- `pnpm exec prettier --check .claude/agents/payments-engineer.md AGENTS.md CLAUDE.md scripts/check-release-safety.mjs .hermes/overnight/manager-heartbeat.md` — failed on formatting for `AGENTS.md`, `scripts/check-release-safety.mjs`, and `.hermes/overnight/manager-heartbeat.md`.
- Pattern scans:
  - `apps/mobile`: no `service_role` / `SUPABASE_SERVICE_ROLE` references.
  - `apps/mobile`: no direct `.from(...).insert/update/delete/upsert` into `groups`, `group_members`, `expenses`, `expense_shares`, `settlements`, or `activity_log`.
  - Stale active-agent payment-processing phrases (`Future: merchant API`, token checkout, bKash merchant API, `payments-engineer` + Stripe, `settlements.external_ref`) only matched the new release-safety deny pattern itself.
  - `packages/i18n/src/*.json`: no English/Bengali `wallet` settlement copy matches.
  - Sensitive logging proximity scan found no `console.*` / Sentry call near MFS, OTP, token, JWT, payment-reference, or transaction-id terms.
  - Entitlement bypass scan found no `grantsEntitlementLocally: true`; `client_purchase_result` and `manual_ui_toggle` remain explicit untrusted sources in `packages/monetization/src/billing-boundary.test.ts`.

### Findings

#### LOW — Delete-account Edge Function log redaction is narrower than the app/payment redaction contract

- Paths:
  - `supabase/functions/delete-account/index.ts:32-51`
  - `docs/DATA_MODEL.md:441`
  - Comparison controls: `apps/mobile/src/lib/sentry.ts:14-26`, `packages/payments/src/log.ts:17-26`, `packages/monetization/src/analytics-events.ts:24-28`
- Evidence: `logDeleteAccountError` currently redacts only contiguous `+8801...` / `01...` phone formats in an error message before `console.error("delete-account failed", fields)`. The docs still say this path uses `maskMfsNumber` from `@baki/payments`, while the implementation uses a local helper and does not cover spaced/masked BD phone formats, Bearer/JWT/token/OTP strings, or payment-reference aliases (`reference`, `trxId`, `transactionId`, `orderId`, receipt/MFS aliases) now covered by mobile Sentry and monetization analytics.
- Risk: current code does not log request headers or body, so exposure likelihood is low. But future RPC/client error strings or added log context could place broader sensitive values in Supabase Edge Function logs without the same redaction coverage as mobile/analytics.
- Recommended fix: port/share a small Deno-safe redaction helper for Edge Functions that covers phone/MFS formats, bearer/JWT/token/OTP strings, and payment-reference aliases; add unit tests or a lightweight script test for `logDeleteAccountError`; update `docs/DATA_MODEL.md` to match the actual helper used.

#### LOW — Current uncommitted guidance/release-safety diff is not Prettier-clean

- Paths:
  - `AGENTS.md`
  - `scripts/check-release-safety.mjs`
  - `.hermes/overnight/manager-heartbeat.md`
- Evidence: `pnpm exec prettier --check ...` reported formatting warnings for those three files.
- Risk: not a direct security issue, but it can create CI/review noise around the release-safety guardrail change.
- Recommended fix: run Prettier on the changed guidance/release-safety files or manually wrap the long table/regex/report lines before committing.

### Positive observations

- The current uncommitted diff removes stale Stripe/merchant-API ownership from active `payments-engineer` guidance and adds a release-safety guard against reintroducing that guidance.
- Store/payment positioning remains ledger-only: no purchase enablement, entitlement grants, wallet/custody, settlement fees, webhook auto-confirmation, or in-app money movement were introduced.
- Monetization billing remains disabled by default, billing products keep `grantsEntitlementLocally: false`, and client/manual entitlement sources remain untrusted.
- E2E seed auth remains production-gated by `app.config.ts` and `test-auth-guard.ts`; targeted guard tests passed.
- Sentry and analytics redaction tests now cover payment-reference aliases and spaced/masked Bangladesh phone formats.

## 2026-07-05T00:57:13Z — monetization/payments/privacy/static review

### Scope inspected

- Changed files from `git status --short` / `git diff --name-only`:
  - `docs/BANGLADESH_CONTEXT.md`
  - `docs/MONETIZATION_READINESS.md`
  - `docs/PRD.md`
  - `docs/ROADMAP.md`
  - `packages/monetization/src/analytics-events.ts`
  - `packages/monetization/src/analytics-events.test.ts`
  - `packages/monetization/src/catalog.test.ts`
  - `packages/monetization/src/features.ts`
  - `packages/monetization/src/plans.ts`
  - `pnpm-lock.yaml`
- Related boundary files reviewed: `packages/monetization/src/billing-boundary.ts`, `packages/monetization/src/billing-boundary.test.ts`, `packages/payments/src/*`, mobile settlement/Sentry/E2E guard files, app/store/privacy docs, i18n settlement copy.
- No changed files under `packages/db` or `supabase`; Docker/Supabase local stack was not started.

### Lightweight checks run

- `pnpm --filter @baki/monetization test` — passed, 17 tests.
- `pnpm --filter @baki/monetization typecheck` — passed.
- `pnpm --filter @baki/monetization lint` — passed.
- `pnpm --filter @baki/payments test` — passed, 15 tests.
- `pnpm --filter @baki/i18n check` — passed, 2 tests.
- `pnpm --filter mobile test -- src/lib/sentry.test.ts src/features/e2e/test-auth-guard.test.ts` — passed, 9 tests.
- `pnpm release:safety` — passed: no mobile service-role references, no mobile direct writes to protected ledger lifecycle tables, no unsafe benchmark wording.
- Static pattern scan: no service-role key references in `apps/mobile`, no direct mobile `.from(...).insert/update/delete/upsert` against money/ledger tables, no console logs near MFS/OTP/token/payment-reference terms.

### Findings

#### MEDIUM — Sentry redaction does not yet match the expanded payment-reference analytics redaction

- Paths:
  - `apps/mobile/src/lib/sentry.ts:14-22`
  - `apps/mobile/src/features/settlement/open-settlement.ts:38-42`
  - Comparison/positive control: `packages/monetization/src/analytics-events.ts:24-28`
- Evidence: monetization analytics now redacts `reference`, `trxId`, `transactionId`, `orderId`, receipt/MFS aliases, spaced BD phone numbers, and JWTs. The mobile Sentry scrubber still only redacts phone/JWT/token/OTP/`external_ref`/push-token text and keys matching phone/bKash/Nagad/token/OTP/JWT/external_ref.
- Risk: `openSettlement` captures deep-link errors. A platform error can include the attempted bKash URL, whose query can contain `reference=<settlement note>`. Current `beforeSend` would redact the phone number but not a `reference=` note or future `trxId`/`transactionId`/`orderId` aliases.
- Recommended fix: share one redaction helper/pattern set between analytics and Sentry, or expand `redactSensitiveSentryText` + `sensitiveKeyPattern` to include `reference`, `payment_ref`, `trxId`, `transactionId`, `orderId`, `receipt`, and `mfs`; add Sentry tests mirroring `analytics-events.test.ts`.

#### MEDIUM — Active/archived agent guidance still contains stale merchant-API roadmap wording

- Paths:
  - `.claude/agents/payments-engineer.md:59-68`
  - `AGENTS.md:51`
  - `CLAUDE.md:13`
  - `docs/ARCHITECTURE.md:33`
  - Archived/bootstrap copies: `baki-bootstrap/.claude/agents/payments-engineer.md:51-58`, `baki-bootstrap/docs/PRD.md:39`, `baki-bootstrap/docs/ARCHITECTURE.md:27`, `baki-bootstrap/docs/BANGLADESH_CONTEXT.md:55-59`, `baki-bootstrap/docs/ROADMAP.md:64`
- Evidence: changed canonical docs now say merchant checkout, wallet/custody, settlement fees, webhook auto-confirmation, and in-app money movement are not on the monetization roadmap without a separate regulated-payments decision. The active payments subagent prompt still says “Future: merchant API (v1.5+)” and describes token checkout/webhooks/reconciliation; root agent docs still name Stripe as payments-engineer ownership.
- Risk: future AI-agent work can reintroduce payment-processing claims or code paths despite the updated PRD/roadmap/store positioning.
- Recommended fix: update active `.claude/agents/payments-engineer.md` and root agent metadata to mirror `docs/MONETIZATION_READINESS.md`; either update `baki-bootstrap/` copies or mark/exclude them as historical so scans/agents do not treat them as current guidance.

#### LOW — User-facing settlement copy repeatedly says “wallet”

- Paths:
  - `packages/i18n/src/en.json:331-359`
  - `packages/i18n/src/bn.json:331-359`
- Evidence: settlement guide/notices use “Open wallet”, “Mobile wallet”, “wallet app handles the money”, and Bengali equivalents. Store docs correctly say Baki is an expense ledger and does not hold/process money.
- Risk: “wallet” language can weaken App Store/Play reviewer positioning around “not a wallet / not money transmitter,” especially next to Finance category metadata.
- Recommended fix: prefer “bKash/Nagad app”, “MFS app”, or “payment app” in user-facing copy, while preserving the explicit “payment happens outside Baki” boundary.

#### INFO / accepted boundary — E2E seed credentials are public but production-gated

- Paths:
  - `apps/mobile/eas.json:35-39`
  - `.github/workflows/eas-preview.yml:53-58`
  - `apps/mobile/app.config.ts:87-97`
  - `apps/mobile/src/features/e2e/test-auth-guard.ts:55-91`
- Evidence: preview-e2e embeds seed email/password/user ID via `EXPO_PUBLIC_*`; production config throws when E2E mode is enabled for production markers, and guard tests passed.
- Recommended fix: keep these credentials preview/test-only, rotate if reused outside preview, and keep `EXPO_PUBLIC_E2E_MODE` disabled for production builds.

### Positive observations

- Changed monetization docs strengthen the non-custodial boundary: no payment processing, wallet/custody, merchant checkout, settlement fees, webhook auto-confirmation, or in-app money movement.
- `packages/monetization` keeps billing disabled by default, `grantsEntitlementLocally: false`, and rejects client/manual entitlement sources.
- New analytics redaction tests cover payment-reference aliases and spaced Bangladeshi phone numbers.
- No schema/RLS changes were present in this diff; live RLS verification was intentionally skipped because the local Supabase stack is shut down.
