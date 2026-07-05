# Overnight Security Watchdog

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
