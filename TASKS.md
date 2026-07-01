# Trusted Tester MVP Hardening Checklist

## Done

- Branch created: `codex/trusted-tester-mvp-hardening`
- Selected Baki monogram kept as the app icon source of truth.
- Unused icon experiments moved out of bundled mobile assets.
- `pnpm --filter mobile check:assets` verifies active icon files.
- Queued expense/settlement replay is wired into app startup, foreground, interval, and manual retry.
- Temporary expense/settlement RPC failures now save as pending offline changes instead of hard-failing the form.
- Permanent expense/settlement errors remain visible as failed sync items and are not shown as success.
- Settings -> Sync shows pending/failed counts, last sync time, retry, and failed item details.
- CI now starts/resets local Supabase before DB checks, runs DB tests, asset checks, aggregate `pnpm check`, and `git diff --check`.
- Automated release gate documented in `docs/QA/AUTOMATED_RELEASE_GATE.md`.
- Local WatermelonDB schema, migrations, models, and repositories are scaffolded.
- Groups and expenses hydrate from local cache and revalidate Supabase.
- Balances fall back to local ledger math before MMKV cache.
- Settle screen uses `simplify_debts` first and raw balance allocation only as fallback.
- Group and tab activity read real `activity_log` rows.

## In Progress

- GitHub Actions verification after the merge PR is opened.
- Seeded authenticated-state Maestro setup for future cloud E2E.
- Remote/local cache breadth beyond the core read paths.

## Blockers

- Full EAS + Maestro release gating is blocked by authenticated state: OTP cannot be automated safely and no seeded test-auth entry point exists.
- NetInfo is not installed, so replay is lifecycle/interval driven.
- `group.create` is queued but not replayed until a safe idempotent group-create path exists.

## Next 5 Tasks

1. Wait for PR GitHub Actions and fix any CI-only failure.
2. Add seeded authenticated-state Maestro setup so flows can run without OTP.
3. Promote EAS + Maestro to a real release gate after seeded auth exists.
4. Add a repair/dismiss UX for permanently failed queued mutations.
5. Add richer local profile/member caching for offline activity actor names.
