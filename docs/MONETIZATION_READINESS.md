# Monetization Readiness

Updated: 2026-07-04

## Positioning

Baki is a Bengali-first shared expense ledger. The free core app must stay useful enough for groups to invite members and build habit. Baki does not hold money, move money, process payments, or take a settlement fee. Cash, bKash, Nagad, and other settlements are completed outside Baki and then recorded in the ledger.

## Pricing ladder to prepare for

| Tier | Scope | Launch posture | Intended value |
| --- | --- | --- | --- |
| Baki Free | User + groups | Available core | Create/join khatas, add/edit/delete expenses, custom splits, balances, outside-app settlement recording, activity, Bengali/English, BDT, basic offline queue. |
| Baki Plus | Individual | Future paid | Receipt scan, advanced search, personal reports, recurring bills, custom categories, unlimited history/archive, richer export. |
| Khata Pro | Group | Future paid | Monthly close, PDF/Excel group reports, admin approval, advanced roles, respectful settlement reminders, audit history, receipt storage. |
| Baki Teams | Workspace | Later | Multiple khatas, team admins, member permissions, accounting exports, support. |

## Current implementation boundary

The first safe foundation lives in `packages/monetization`:

- `src/plans.ts` defines the stable plan keys.
- `src/features.ts` defines feature ids and which plan owns each feature.
- `src/analytics-events.ts` defines safe analytics event names plus redaction helpers.
- `src/billing-boundary.ts` defines typed billing products and a disabled billing client.

This package intentionally does **not** enable purchases, entitlements, paywalls, wallet behavior, payment processing, settlement fees, or local entitlement grants.
The English `title` / `description` values in the catalog are internal metadata only and are marked with `copyScope: "internal_metadata_not_ui_copy"`; mobile screens must use localized `packages/i18n` strings instead of rendering catalog metadata directly.

The first mobile value preview is the Monthly Khata Report in `apps/mobile/app/group/[id]/report.tsx`, linked from group settings as a free beta preview and cataloged as `report.monthly_preview` / `free_beta`. It uses localized copy and redacted breadcrumb analytics only; it does not enable billing or block any existing beta/core flow. The later paid `report.monthly_close` remains reserved for full Khata Pro monthly close/export workflows.

## Guardrails

1. Do not charge for basic group creation, expense recording, custom splits, balance viewing, settlement recording, basic activity, or basic offline queueing.
2. Do not put consumer digital subscriptions through Stripe or a custom mobile checkout inside the iOS/Android apps.
3. Do not grant paid entitlements from a client-side purchase result. Future purchases must be verified server-side first.
4. Do not add real money movement to `packages/payments`; it remains only for bKash/Nagad settlement handoff.
5. Do not add bKash/Nagad merchant APIs, wallet/custody, settlement fees, webhook auto-confirmation, or in-app money movement to the monetization roadmap without a separate regulated-payments decision.
6. Do not log phone numbers, bKash/Nagad numbers, OTPs, tokens, payment references (`reference`, `external_ref`, `trxId`, `transactionId`, `orderId`, etc.), or raw receipt content in analytics.
7. If a feature is already available in beta, mark it `free_beta` before any future paywall experiment rather than silently removing it. Deferred features, such as receipt attachment storage, must not be marked `free_beta` until they actually ship.
8. Keep Bengali and English copy in parity for every user-facing monetization surface.
9. Offline behavior must fail open for free core functionality and avoid blocking beta users because entitlement state is unknown offline.

## Next implementation stages

### Stage 1 — complete safe foundations

- Expand the mobile no-op analytics adapter using the event catalog.
- Add read-only entitlement model and cache shape, defaulting to free core.
- Add `FeatureGate` UI that can educate users but does not block current beta flows.
- Add Bengali/English copy for plan education and billing-disabled states.

### Stage 2 — soft monetization UI, no charging

- Add Settings → Plan screen showing Free/Beta, Baki Plus coming soon, and Khata Pro preview.
- Add group admin Khata Pro preview from group settings.
- Track upgrade-interest events through the redacted no-op/Sentry-breadcrumb analytics adapter.

### Stage 3 — server-verified IAP sandbox

- Add a selected IAP SDK only after store product ids are ready.
- Add server verification for Apple/Google receipts before writing entitlement grants.
- Keep sandbox/test and production environments separated.

### Stage 4 — Khata Pro group entitlements

- Add group-scoped grants for monthly close/report/export/admin features.
- Keep direct client writes disabled for entitlement tables.
- Add RLS tests for user and group grant visibility.

### Stage 5 — Teams later

- Defer workspace billing, invoices, admin dashboard, and business support until Baki has clear active-group traction.

## Verification

Current foundation checks:

```bash
pnpm --filter @baki/monetization test
pnpm --filter @baki/monetization typecheck
pnpm --filter @baki/monetization lint
```

Docker/Supabase is not required for the current package-level foundation checks.
