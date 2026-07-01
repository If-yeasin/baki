# Maestro E2E Flows

Critical-path flows for the Baki mobile app. They target a Dev Client or
preview build; Expo Go is only useful for light UI smoke because it does not
exercise the native offline-storage runtime.

## Install Maestro

```bash
brew install maestro-cli
```

## Auth Strategy

Preview/dev E2E builds use a guarded seed-auth route instead of phone OTP:

- route: `baki://e2e/seed-auth`
- required flag: `EXPO_PUBLIC_E2E_MODE=true`
- allowed variants: local `__DEV__`, `development`, `development:device`, `preview`, or `preview-e2e`
- blocked variants: `production` / `prod`
- allowed Supabase targets: `EXPO_PUBLIC_SUPABASE_ENV=local`, `preview`, or `test`
- seeded account: `rini@example.test`, user id `22222222-2222-4222-8222-222222222222`

The route signs in through Supabase Auth with the local/test password fixture.
It does not inject JWTs, does not log OTPs, and does not use a service-role key.
Do not run seed-auth against production Supabase.

## Local Setup

```bash
pnpm install --frozen-lockfile
pnpm --filter @baki/db exec supabase db start --workdir ../..
pnpm --filter @baki/db exec supabase db reset --workdir ../..
```

Start the app with E2E mode enabled:

```bash
EXPO_PUBLIC_E2E_MODE=true \
EXPO_PUBLIC_APP_CHANNEL=preview \
EXPO_PUBLIC_E2E_SEED_EMAIL=rini@example.test \
EXPO_PUBLIC_E2E_SEED_PASSWORD=password \
EXPO_PUBLIC_E2E_SEED_USER_ID=22222222-2222-4222-8222-222222222222 \
EXPO_PUBLIC_SUPABASE_ENV=local \
pnpm --filter mobile dev:devclient
```

Run the authenticated preview flow:

```bash
maestro test e2e/maestro/60-preview-trusted-tester.yaml
```

Run only the auth bootstrap:

```bash
maestro test e2e/maestro/00-e2e-auth.yaml
```

## Optional EAS Preview E2E

The optional EAS workflow is `.eas/workflows/preview-e2e.yml`. Trigger it
manually or by adding the `build:preview-e2e` label to a pull request. It builds
Android with the `preview-e2e` profile and runs
`60-preview-trusted-tester.yaml`.

Required preview env/secrets:

- `EAS_PROJECT_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_ENV=preview` or `test`
- `EXPO_PUBLIC_SENTRY_DSN`
- dedicated hosted preview/test Supabase seeded with the trusted-tester fixture

The GitHub Actions workflow `.github/workflows/eas-preview.yml` also supports
the `build:preview-e2e` label for an Android preview-E2E build. That path does
not run Maestro by itself.

## Offline Sync QA

Real Airplane Mode is not automated in these flows. Maestro/cloud device network
control is not reliable enough to make that a release claim. Queue/replay logic
is covered by unit and DB tests, and a Dev Client real-device offline pass is
still recommended before public beta.

## Flow Inventory

| File                              | What it verifies                                               |
| --------------------------------- | -------------------------------------------------------------- |
| `00-launch.yaml`                  | App launches and renders the Bengali brand text                |
| `00-e2e-auth.yaml`                | E2E seed-auth route signs in and reaches the seeded home screen |
| `10-create-group.yaml`            | Create-khata flow with trip template                           |
| `20-add-expense.yaml`             | Add an expense, see Bengali numerals render                    |
| `30-view-balance.yaml`            | Per-group balances tab shows owe/owed state                    |
| `40-settle.yaml`                  | bKash deep link local/device smoke only; tagged `ci-skip`      |
| `50-activity.yaml`                | Real activity feed is reachable from a group                   |
| `60-preview-trusted-tester.yaml`  | Auth, seeded group, expense, cash settlement, sync, activity   |

## Required App TestIDs

Prefer `id:` selectors over copy selectors.

| testID                     | Screen                                  | Element                                                  |
| -------------------------- | --------------------------------------- | -------------------------------------------------------- |
| `e2e-auth-ready`           | `app/e2e/seed-auth.tsx`                 | Seed-auth ready state                                    |
| `e2e-auth-continue`        | `app/e2e/seed-auth.tsx`                 | Continue to app button                                   |
| `tab-groups`               | `app/(tabs)/_layout.tsx`                | Groups tab                                               |
| `tab-balances`             | `app/(tabs)/_layout.tsx`                | Balances tab                                             |
| `tab-activity`             | `app/(tabs)/_layout.tsx`                | Activity tab                                             |
| `tab-settings`             | `app/(tabs)/_layout.tsx`                | Settings tab                                             |
| `group-card-{index}`       | `app/(tabs)/index.tsx`                  | Group card in the groups list                            |
| `group-name-input`         | `app/groups/create.tsx`                 | Khata name input                                         |
| `group-balance-action-card` | `app/group/[id]/index.tsx`              | Group balance/action card                                |
| `settle-cta`               | `app/group/[id]/index.tsx`              | Settle action                                            |
| `add-expense-header-cta`   | `app/group/[id]/index.tsx`              | Add expense action in the balance card                   |
| `add-expense-fab-floating` | `app/group/[id]/index.tsx`              | Add expense FAB                                          |
| `group-activity-cta`       | `app/group/[id]/index.tsx`              | Group activity/history row                               |
| `activity-feed-list`       | `src/components/activity-feed-list.tsx` | Rendered activity feed                                   |
| `sync-retry-now`           | `app/settings/sync.tsx`                 | Manual sync retry button                                 |
| `expense-queued-notice`    | `app/group/[id]/add-expense.tsx`        | Saved-offline notice after a queued expense              |
| `amount-input`             | `app/group/[id]/add-expense.tsx`        | Amount input                                             |
| `description-input`        | `app/group/[id]/add-expense.tsx`        | Description input                                        |
| `expense-save-cta`         | `app/group/[id]/add-expense.tsx`        | Save button                                              |
| `settle-row-{index}`       | `app/group/[id]/settle.tsx`             | Settlement card wrapper                                  |
| `settle-bkash-{index}`     | `app/group/[id]/settle.tsx`             | bKash settlement tile                                    |
| `settle-nagad-{index}`     | `app/group/[id]/settle.tsx`             | Nagad settlement tile                                    |
| `settle-cash-{index}`      | `app/group/[id]/settle.tsx`             | Cash settlement tile                                     |
| `settle-other-{index}`     | `app/group/[id]/settle.tsx`             | Other settlement tile                                    |
| `settle-mark-paid-cta`     | `app/group/[id]/settle.tsx`             | MFS mark-paid confirmation button                        |

## CI Status

The GitHub `CI` workflow does not run Maestro. The optional EAS Workflow can run
Maestro after a preview build, but it is not a required release gate until the
team has a passing run on hosted preview infrastructure.
