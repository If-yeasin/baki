# Automated Release Gate

## Decision

PR #1 uses a Path B automated-first release gate.

Full EAS + Maestro automation is not configured for this PR because the current
Maestro flows require a signed-in Dev Client state and the phone OTP flow is not
safely automated in CI. Adding a test-auth bypass would create a new auth surface
for the app, so this pass relies on strengthened local tests plus GitHub Actions.

Manual real-device offline replay QA was not performed. The release gate currently
relies on automated tests and CI. Real-device verification remains recommended
before public beta.

## Automatically Verified

GitHub Actions `CI` runs on pull requests and pushes to `main`:

- `pnpm install --frozen-lockfile`
- local Supabase database start + `supabase db reset`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm i18n:check`
- `pnpm db:check`
- `pnpm --filter mobile check:assets`
- `pnpm check`
- `git diff --check`

The automated tests cover the trusted-tester offline money-write gate at code and
database levels:

- temporary `create_expense` RPC errors return queued success
- temporary `create_settlement` RPC errors return queued success
- permanent money-write failures remain visible as failed queued mutations
- queue replay calls `create_expense` and `create_settlement`, not direct table inserts
- failed permanent mutations are skipped until explicit retry
- `create_expense` idempotency prevents duplicate expenses, shares, and activity rows
- `create_settlement` idempotency prevents duplicate settlements and activity rows
- sync indicator state priority is deterministic
- Settings -> Sync metric and failed-row presentation logic is deterministic
- simplified debts raw-balance fallback uses integer paisa allocation

## Not Automatically Verified

- Dev Client/TestFlight behavior on a physical iPhone
- OS-level Airplane Mode transitions
- WatermelonDB persistence across app reinstall, kill, or native storage edge cases
- real Supabase hosted-project network latency and SMS provider behavior
- bKash/Nagad native-app handoff and return behavior
- EAS Preview build success unless the optional preview workflow is triggered
- Maestro authenticated end-to-end flow in cloud CI

## Risk Level

Risk is medium for a small trusted-tester merge because the highest-risk ledger
paths are covered by unit and DB tests, including idempotent replay. Risk remains
too high for public beta without at least one real-device offline replay pass.

## Known Limitations

- `group.create` can be queued but is not replayed yet because group creation is not idempotent.
- NetInfo is not installed; replay is driven by startup, foreground, interval, and manual retry.
- Expo Go cannot validate the native offline-storage path.
- Maestro flows are smoke/critical-path assets, not a CI release gate, until seeded auth exists.

## Trigger CI

Open or update a pull request, or push to `main`. CI should show the `checks`
job as passing before merge.

## Trigger EAS Preview

Add the `build:preview` label to the pull request. This optional workflow runs:

```bash
pnpm dlx eas-cli@latest build --profile preview --platform ios --non-interactive
```

Required GitHub secrets:

- `EXPO_TOKEN`
- `EAS_PROJECT_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`

EAS Preview is not part of the PR #1 automated release gate unless it is triggered
and passes before merge.

## Run Locally

```bash
pnpm install --frozen-lockfile
pnpm --filter @baki/db exec supabase db start --workdir ../..
pnpm --filter @baki/db exec supabase db reset --workdir ../..
pnpm lint
pnpm typecheck
pnpm test
pnpm i18n:check
pnpm db:check
pnpm --filter mobile check:assets
pnpm check
git diff --check
```

## Duplicate Ledger SQL

Run against local Supabase after replay-oriented tests or manual investigation:

```sql
select client_mutation_id, count(*) as expense_count
from public.expenses
where client_mutation_id is not null
group by client_mutation_id
having count(*) > 1;

select client_mutation_id, count(*) as settlement_count
from public.settlements
where client_mutation_id is not null
group by client_mutation_id
having count(*) > 1;

select e.client_mutation_id, count(s.id) as share_count
from public.expenses e
join public.expense_shares s on s.expense_id = e.id
where e.client_mutation_id is not null
group by e.client_mutation_id
having count(s.id) <> 2;
```

For the seeded two-member trusted-tester fixtures, these queries should return
no duplicate mutation ids and exactly two shares for equal-split replay cases.

## Go / No-Go

Go:

- PR CI `checks` passes on the latest commit.
- The full local command set above passes.
- Docs state that manual real-device QA was skipped.
- No direct client inserts into `expenses`, `expense_shares`, or `settlements` are introduced.

No-go:

- Any required CI/local command fails.
- DB tests skip because local Supabase was not started/reset.
- A money-writing path bypasses `create_expense` or `create_settlement`.
- The PR claims real-device offline replay was verified when it was not.
