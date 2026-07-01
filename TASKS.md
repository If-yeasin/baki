# Trusted Tester MVP Hardening Checklist

## Done

- Branch created: `codex/automated-preview-e2e-gate`
- Selected Baki monogram kept as the app icon source of truth.
- Unused icon experiments moved out of bundled mobile assets.
- `pnpm --filter mobile check:assets` verifies active icon files.
- Queued expense/settlement replay is wired into app startup, foreground, interval, and manual retry.
- Temporary expense/settlement RPC failures now save as pending offline changes instead of hard-failing the form.
- Permanent expense/settlement errors remain visible as failed sync items and are not shown as success.
- Settings -> Sync shows pending/failed counts, last sync time, retry, and failed item details.
- CI now starts/resets local Supabase before DB checks, runs DB tests, asset checks, aggregate `pnpm check`, and `git diff --check`.
- Automated release gate documented in `docs/QA/AUTOMATED_RELEASE_GATE.md`.
- Dev/preview-only seeded E2E auth route exists at `baki://e2e/seed-auth`.
- Maestro preview trusted-tester flow added for auth, add expense, cash settlement, Settings -> Sync, and Activity.
- Optional Android preview-E2E EAS build/workflow added under `build:preview-e2e`.
- Release safety scan checks for mobile service-role use, direct money-table inserts, and unsafe benchmark wording.
- Local WatermelonDB schema, migrations, models, and repositories are scaffolded.
- Groups and expenses hydrate from local cache and revalidate Supabase.
- Balances fall back to local ledger math before MMKV cache.
- Settle screen uses `simplify_debts` first and raw balance allocation only as fallback.
- Group and tab activity read real `activity_log` rows.

## In Progress

- GitHub Actions verification for the automated preview E2E gate PR is pending until the new PR checks pass.
- Remote/local cache breadth beyond the core read paths.
- First real EAS/Maestro preview-E2E run on hosted preview env.

## Blockers

- Full EAS + Maestro release gating is not required yet; it should become a gate only after the optional preview-E2E workflow passes on hosted preview infrastructure.
- NetInfo is not installed, so replay is lifecycle/interval driven.
- `group.create` is queued but not replayed until a safe idempotent group-create path exists.

## Next 5 Tasks

1. Open the automated preview E2E gate PR and wait for GitHub Actions.
2. Run the optional `build:preview-e2e` EAS/Maestro path on hosted preview env.
3. Promote EAS + Maestro to a real release gate after a green preview-E2E run.
4. Add a repair/dismiss UX for permanently failed queued mutations.
5. Add richer local profile/member caching for offline activity actor names.
