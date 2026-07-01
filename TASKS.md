# Trusted Tester MVP Hardening Checklist

## Done

- Branch created: `codex/trusted-tester-mvp-hardening`
- Selected Baki monogram kept as the app icon source of truth.
- Unused icon experiments moved out of bundled mobile assets.
- `pnpm --filter mobile check:assets` verifies active icon files.
- Queued expense/settlement replay is wired into app startup, foreground, interval, and manual retry.
- Settings -> Sync shows pending/failed counts, last sync time, retry, and failed item details.
- Local WatermelonDB schema, migrations, models, and repositories are scaffolded.
- Groups and expenses hydrate from local cache and revalidate Supabase.
- Balances fall back to local ledger math before MMKV cache.
- Settle screen uses `simplify_debts` first and raw balance allocation only as fallback.
- Group and tab activity read real `activity_log` rows.

## In Progress

- Full device QA for offline replay on a Dev Client.
- Maestro coverage for authenticated trusted-tester flow.
- Remote/local cache breadth beyond the core read paths.

## Blockers

- OTP cannot be automated reliably in Maestro; tester must sign in once manually.
- NetInfo is not installed, so replay is lifecycle/interval driven.
- `group.create` is queued but not replayed until a safe idempotent group-create path exists.

## Next 5 Tasks

1. Run the full quality gate suite on a machine with local Supabase available.
2. Walk the manual offline replay test on a physical iPhone Dev Client.
3. Add seeded authenticated-state Maestro setup so flows can run without OTP.
4. Add a repair/dismiss UX for permanently failed queued mutations.
5. Add richer local profile/member caching for offline activity actor names.
