# Automated Release Gate

## Decision

Current state uses an automated unit/DB gate plus an optional preview E2E path.

The repo now has a safe non-production E2E auth entry point:

- route: `baki://e2e/seed-auth`
- code: `apps/mobile/src/features/e2e/*`
- build flag: `EXPO_PUBLIC_E2E_MODE=true`
- EAS profile: `preview-e2e`
- seeded account: `rini@example.test` / `22222222-2222-4222-8222-222222222222`

The route signs in through Supabase Auth with the local/test seeded password
fixture. It does not inject JWTs, does not automate SMS OTP, does not log OTPs,
and does not use the service-role key. The entry point fails closed unless all
of these are true:

- `EXPO_PUBLIC_E2E_MODE=true`
- the build is local dev or a preview/dev EAS variant
- the app is not production-marked by build profile or channel
- `EXPO_PUBLIC_SUPABASE_ENV` is `local`, `preview`, or `test`
- the expected seeded user id, email, and password fixture are present
- Supabase URL and anon key are configured

`app.config.ts` throws if E2E mode is enabled for a production profile/channel,
or if E2E mode does not explicitly target a local, preview, or test Supabase
environment.

Manual real-device offline replay QA was not performed. The release gate currently
relies on automated tests, CI, and optional EAS/Maestro preview automation.
Real-device verification remains recommended before public beta.

## Automatically Verified

GitHub Actions `CI` runs on pull requests and pushes to `main`:

- `pnpm install --frozen-lockfile`
- local Supabase database start + `supabase db reset`
- `pnpm db:types:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm i18n:check`
- `pnpm db:check`
- `pnpm --filter mobile check:assets`
- `pnpm e2e:auth:check`
- `pnpm release:safety`
- `pnpm check`
- `git diff --check`

`pnpm check` also runs `pnpm release:safety`, which scans for:

- Supabase service-role references in mobile code
- direct client writes into group lifecycle, money, or activity tables
- unsafe benchmark wording

The automated tests cover the trusted-tester offline money-write gate at code,
mobile, and database levels:

- E2E/test-auth is disabled without the E2E flag
- E2E/test-auth is disabled for production profiles/channels
- E2E seed sign-in only persists the expected seeded user id
- local seed data includes users, group, expenses, settlement, activity, and a simplified debt plan
- temporary `create_expense` and `edit_expense` RPC errors return queued success
- temporary `delete_expense` RPC errors remain replayable through the queue
- temporary `create_settlement` RPC errors return queued success
- permanent money-write failures remain visible as failed queued mutations
- queue replay calls `create_group`, `create_expense`, `edit_expense`, `delete_expense`, and `create_settlement`, not direct table writes
- direct client inserts/updates/deletes into group lifecycle, money, and activity tables are denied by RLS tests
- money-writing RPCs reject archived and soft-deleted groups for create/edit/delete expense and create settlement
- failed permanent mutations are skipped until explicit retry
- `create_expense` idempotency prevents duplicate expenses, shares, and activity rows
- `edit_expense` and `delete_expense` idempotency prevent duplicate activity through mutation receipts
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
- EAS Preview build success unless the optional preview workflow is triggered and passes
- Maestro authenticated end-to-end flow in EAS unless `.eas/workflows/preview-e2e.yml` is triggered and passes
- hosted preview Supabase seed availability unless the preview project is reset/seeded with the trusted-tester fixture

## Risk Level

Risk is medium for a small trusted-tester merge because the highest-risk ledger
paths are covered by unit and DB tests, including idempotent replay. The optional
preview E2E path lowers auth-gating risk for trusted-tester previews, but risk
remains too high for public beta without at least one real-device offline replay
pass.

## Known Limitations

- NetInfo is not installed; replay is driven by startup, foreground, interval, and manual retry.
- Expo Go cannot validate the native offline-storage path.
- EAS/Maestro preview E2E is optional until a real run passes and the team decides to make it required.
- OS-level Airplane Mode is not automated in Maestro; queue/replay behavior is covered by unit/integration tests.
- Receipt upload and server-side push delivery are not covered by the current automated gate until those server boundaries land.

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

EAS Preview is not part of the required automated gate unless it is triggered and
passes before merge.

## Trigger Preview E2E

There are two optional preview E2E paths:

1. Add the `build:preview-e2e` label to a pull request. GitHub Actions runs an
   Android EAS build with `--profile preview-e2e`.
2. Trigger `.eas/workflows/preview-e2e.yml` manually or by the same
   `build:preview-e2e` PR label. The EAS Workflow builds Android with
   `preview-e2e`, then runs `e2e/maestro/60-preview-trusted-tester.yaml`.

Required preview environment/secrets:

- `EXPO_TOKEN` for the GitHub Actions EAS build path
- `EAS_PROJECT_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_SUPABASE_ENV=preview` or `test`
- dedicated preview/test Supabase project seeded with `packages/db/seed.sql`, or equivalent seeded users/group data

Do not point preview-E2E seed-auth builds at production Supabase. The seeded
password fixture is non-secret test data and must only exist in local,
preview, or test projects.

The preview E2E path is not a required release gate until a real EAS/Maestro run
has passed on the current branch.

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
pnpm db:types:check
pnpm --filter mobile check:assets
pnpm e2e:auth:check
pnpm release:safety
pnpm check
git diff --check
```

To run the Maestro trusted-tester flow locally:

```bash
pnpm --filter @baki/db exec supabase db reset --workdir ../..
EXPO_PUBLIC_E2E_MODE=true \
EXPO_PUBLIC_APP_CHANNEL=preview \
EXPO_PUBLIC_E2E_SEED_EMAIL=rini@example.test \
EXPO_PUBLIC_E2E_SEED_PASSWORD=password \
EXPO_PUBLIC_E2E_SEED_USER_ID=22222222-2222-4222-8222-222222222222 \
EXPO_PUBLIC_SUPABASE_ENV=local \
pnpm --filter mobile dev:devclient

maestro test e2e/maestro/60-preview-trusted-tester.yaml
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
- `pnpm e2e:auth:check` and `pnpm release:safety` pass.
- Any claim that EAS/Maestro is a gate links to a passing EAS/Maestro run.

No-go:

- Any required CI/local command fails.
- DB tests skip because local Supabase was not started/reset.
- A money-writing path bypasses `create_expense` or `create_settlement`.
- The PR claims real-device offline replay was verified when it was not.
- The PR claims EAS/Maestro is required when the workflow was not triggered and green.
