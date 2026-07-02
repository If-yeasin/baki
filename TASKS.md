# Baki v1 Release Candidate Checklist

Updated: 2026-07-02

## Done In This RC Sprint

- Branch created: `codex/v1-release-candidate-completion`.
- Gap map added at `docs/V1_RELEASE_CANDIDATE_GAP_MAP.md`.
- Group creation moved to idempotent `create_group` RPC.
- Offline queue now replays `group.create`, `expense.create`, and `settlement.create` through RPCs.
- Group settings route added for rename, type change, archive, leave, safe delete, invite copy/share, and invite regeneration.
- Direct client writes to group lifecycle, money, and activity tables are blocked by RLS/policy hardening.
- Supabase types regenerated after the new migration.
- Store-readiness docs added under `docs/STORE/`.
- Release workflow strengthened to run full gates before production EAS build; App Store submit remains manual.

## Remaining Blockers Before Closed Beta

- Expense edit/delete RPCs and screens are still missing.
- Push notification token registration, preferences, and server delivery are not complete.
- Export CSV is still missing from the app.
- Hosted privacy/support URLs and real App Store Connect credentials are still needed.
- Optional hosted EAS/Maestro preview-E2E has not been promoted to a required gate.

## Release Candidate Checklist

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm i18n:check`
- [ ] `pnpm db:check`
- [ ] `pnpm --filter mobile check:assets`
- [ ] `pnpm e2e:auth:check`
- [ ] `pnpm release:safety`
- [ ] `pnpm check`
- [ ] `git diff --check`
- [ ] Production Supabase migrations verified
- [ ] `delete-account` Edge Function deployed and verified
- [ ] App Store / Play Store metadata reviewed

## Next 5 Tasks

1. Implement expense edit/delete RPCs, app routes, offline queue handling, and DB tests.
2. Add CSV export for a group ledger and a Settings entry that shares the file.
3. Add notification token registration and preferences, or document the credential blocker exactly.
4. Run the optional `build:preview-e2e` EAS/Maestro workflow on a seeded preview Supabase project.
5. Capture screenshot set from a current preview/TestFlight build and link it in `docs/STORE/SCREENSHOTS.md`.
