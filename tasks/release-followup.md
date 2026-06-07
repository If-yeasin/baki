# Release follow-up — TestFlight wave (release-qa-agent)

> Read-only audit produced by `release-qa-agent` on 2026-05-19. Concurrent
> agents (`maestro-testid-agent`, `theme-rollout-agent`,
> `account-delete-backend-agent`, `account-delete-mobile-agent`) are still
> in flight; this report reflects the tree as observed at audit time and
> flags items that depend on their landings.

## A. Apple submission deletion-gate audit (Guideline 5.1.1(v))

### What the wave needs to deliver

Apple Guideline 5.1.1(v) ("Account Sign-In") requires apps that let users
create an account to also let users initiate account deletion **from
within the app**. The full text the App Review team enforces:

> Apps that support account creation must also offer account deletion
> from within the app. Deleting an account should result in the deletion
> of the account from the developer's records as well as any associated
> personal data (or, alternatively, allow the user to request such
> deletion in a clearly-marked location). Apps may include confirmation
> steps to prevent accidental account deletion ... and may use a website
> to comply, but the app must point users there.

Translating that to Baki's contract:

#### 1. Discoverability — accessible **without** a sign-in barrier?

- **Current contract (per `docs/SETUP.md` lines 233–234):** entry lives at
  `Settings → Delete account`. Settings is reachable only after phone
  OTP sign-in.
- **Apple guidance:** "from within the app" — the deletion entry **must
  be reachable in a logged-in state**, and Apple does *not* require a
  pre-login deletion path. Settings-only is acceptable.
- **Status:** PASS, with one caveat — Apple reviewers must be able to
  sign in, and Baki uses SMS OTP that Apple's test devices typically
  cannot receive. The `RELEASE_NOTES.md` reviewer-notes draft and
  `docs/SETUP.md §6` already commit to providing an OTP bypass account
  for review. **Confirm with the orchestrator that the bypass account
  also has at least one demo group / expense / settled balance so the
  reviewer can exercise the deletion flow end-to-end.**

#### 2. On-screen confirmation of deletion / 30-day window

- **What Apple wants:** the user must see clear feedback that their
  account and personal data have been deleted, or have been scheduled
  for deletion within a bounded window (typically ≤ 30 days).
- **Current state in tree:** the live `apps/mobile/app/(tabs)/settings.tsx`
  still surfaces only `t("settings.account.delete_coming_soon")` —
  `"Account deletion is coming soon."` / `"অ্যাকাউন্ট ডিলিটের ফিচার
  শিগগিরই আসছে।"`. This is the stub flagged in `docs/RELEASE_NOTES.md
  §0.2.1` and is fine for TestFlight but a hard blocker for App Store
  submission.
- **What the contract owes the user on first delete:**
  1. A confirmation sheet that names the consequences in BN + EN
     ("You will lose access to N groups and your share of M ledger
     entries will be reassigned to a tombstone user.").
  2. A second irreversible confirmation step (Apple explicitly allows
     this).
  3. A success toast / screen reading the equivalent of
     `"Your account has been deleted. Some receipts may take up to 30
     days to clear from backups per Apple Guideline 5.1.1(v)."` — i18n
     keys must ship in both `bn` and `en`.
  4. Forced sign-out immediately after success.
- **Status:** PENDING on `account-delete-mobile-agent`. Verify the new
  i18n keys land with both locales before merge (CI `i18n:check` will
  catch parity drift).

#### 3. Server-side audit trail

- **Why Apple cares:** if a reviewer or user disputes a deletion,
  Apple expects the developer to prove the request was honored. Audit
  trails are an internal compliance need (PCI-style, not literally PCI)
  rather than a literal review-blocking gate, but Apple's privacy
  policies in App Review increasingly call out "what happens to
  user-generated content after deletion."
- **Tree check:** `docs/DATA_MODEL.md` lists tables `profiles`,
  `groups`, `group_members`, `expenses`, `expense_shares`,
  `settlements`, `activity_log`, `device_tokens`. **None** of them
  carries an `account_deletions` table or a `deletion_requests` table.
  `activity_log.event_type` does not enumerate an `account_deleted`
  event. Migrations `0001`–`0003` confirm — no audit table for
  deletion has shipped.
- **Recommendation (must add for v1.0, can defer past first TestFlight
  beta):** `account-delete-backend-agent` should add a new migration
  (proposed `0004_account_deletion.sql`) that creates a small
  `public.account_deletions` table:
  - `id uuid pk`
  - `user_id uuid not null` (no FK — the profile may already be gone)
  - `requested_at timestamptz not null default now()`
  - `completed_at timestamptz`
  - `client text` (`'mobile-ios'`, `'mobile-android'`)
  - `app_version text`
  - `reason_code text` (optional self-report)
  - RLS: `for all to authenticated using (false) with check (false)`
    — only the edge function (security definer) writes here; users
    never read or write directly.
  - Also extend `activity_log.event_type` allow-list with
    `'member_account_deleted'` so the user's groups see a tombstone
    actor message ("Tanvir deleted their account") rather than data
    silently changing under them.
- **Status:** v1.0 must-add (not a TestFlight blocker, but a public
  App Store submission blocker per our own internal compliance bar).

#### 4. Non-app deletion path

- **Apple's current position (post-2022):** in-app is sufficient. A
  parallel web path is optional. Baki has no web app today.
- **Status:** INFORMATIONAL — no work required for v1.0. If
  `account-delete-mobile-agent` adds a Support URL referencing the
  same flow, mirror that on the Support / Privacy Policy page.

### Per-guideline checklist mapping

| Apple requirement | Contract | TestFlight | App Store v1.0 |
|---|---|---|---|
| In-app deletion entry, no sign-up wall | Settings → Delete account | OK (stub) | PASS (live flow) |
| Confirmation step(s) | Two-step sheet, BN+EN | n/a (stub) | required |
| Deletion or ≤30-day schedule, on-screen | Success screen + sign-out | n/a (stub) | required |
| Personal data deletion or anonymization | Edge function cascades profile; expenses reassigned to tombstone | n/a (stub) | required |
| Audit / compliance trail | `account_deletions` table proposed | not blocking | required for our bar |
| Sign in with Apple alternative | N/A — phone OTP only, reviewer note ready | OK | OK |
| Web deletion path | Not provided; in-app is sufficient | OK | OK |

## B. TestFlight readiness checklist (delta from `docs/SETUP.md` §168–238)

Status legend: `[ ]` pending, `[~]` partial, `[x]` done.

### §1 — Required env vars for an EAS preview build

- `[ ] EXPO_PUBLIC_SUPABASE_URL` — pending: must be set as an EAS Secret
  for the live (not local 54321) Supabase project. Verify via
  `eas secret:list`.
- `[ ] EXPO_PUBLIC_SUPABASE_ANON_KEY` — pending: same. Must be the anon
  key, not the service role.
- `[ ] EXPO_PUBLIC_SENTRY_DSN` — pending: strongly recommended for beta;
  the workflows in `release.yml` and `eas-preview.yml` already wire it
  through if present.
- `[ ] EXPO_PUBLIC_ENABLE_BKASH` — pending: default `true` in
  `app.config.ts`; explicit secret recommended so we can flip from the
  EAS dashboard without a rebuild.
- `[ ] EXPO_PUBLIC_ENABLE_NAGAD` — pending: same.
- `[ ] EAS_PROJECT_ID` — pending: need to fill via
  `eas init` in `apps/mobile/`. `app.config.ts` reads it from
  `process.env.EAS_PROJECT_ID` into `extra.eas.projectId`; without it
  EAS will refuse to build. Verify with `eas project:info`.

### §2 — Pre-build checklist

- `[~] pnpm install --frozen-lockfile` runs clean — pnpm-lock.yaml is
  modified per `git status`; orchestrator should confirm the lock is
  committed and matches `package.json` before the build runs in CI.
- `[~] pnpm typecheck / lint / test / i18n:check / db:check` —
  `db:check` cannot run in this environment (see section C). The
  other four should be re-run on a clean working tree once the
  concurrent agents merge.
- `[~] gen:types against live Supabase` — generated `types.ts` is
  modified per `git status`; verify it was regenerated against the
  **live** project (not just the local one) before the build, per
  the same callout in `docs/SETUP.md §2`.
- `[ ] supabase db push against live` — pending; once
  `account-delete-backend-agent` adds the `0004` migration, the live
  project needs `0001 → 0004` applied in order.
- `[~] RLS verified end-to-end with two users` — covered by
  `packages/db/tests/rls-policies.test.ts`, but the suite auto-skips
  without a local DB (see section C). Must be exercised against the
  live project once.
- `[~] .env.local present locally; EAS Secrets the source for the
  build` — operator-side check; cannot verify from inside this
  read-only audit.
- `[x] App icon, splash, adaptive icon present` — verified
  `apps/mobile/assets/icons/icon.png`, `adaptive-icon.png`,
  `notification-icon.png` exist. (Note: numerous new icon variants in
  `git status` from `theme-rollout-agent`; confirm `app.config.ts`
  still points at the canonical filenames if the rollout agent
  swapped them.)
- `[x] LSApplicationQueriesSchemes includes bkashopen and nagad` —
  confirmed `apps/mobile/app.config.ts` line 17:
  `LSApplicationQueriesSchemes: ["bkashopen", "nagad"]`.
- `[ ] Phone OTP provider configured in Supabase Auth, test number
  allow-listed` — pending; Supabase-dashboard side, cannot verify from
  the repo.

### §3 — Build & submit commands

- `[ ] eas.json submit.production.ios populated` — **BLOCKER**:
  `apps/mobile/eas.json` still has placeholders
  (`appleId: "your-apple-id@example.com"`, `ascAppId: "1234567890"`,
  `appleTeamId: "ABCDE12345"`). Per `docs/SETUP.md §3` these must be
  replaced with real values via EAS Secrets / env (`EXPO_APPLE_ID`,
  `EXPO_ASC_APP_ID`, `EXPO_APPLE_TEAM_ID`) — do NOT commit real
  values. `eas submit` will fail with the current placeholders.
- `[ ] eas build --profile preview --platform ios` — pending; gated
  on the items above.
- `[ ] eas submit --platform ios --profile production` — pending;
  gated on App Store Connect record + build.

### §4 — Dev Client limitations & manual OTP step

- `[ ] eas build --profile development --platform ios` at least once —
  pending; documented as required because Expo Go cannot host
  `react-native-mmkv`, `@nozbe/watermelondb`, `react-native-reanimated`,
  `@sentry/react-native`.
- `[ ] First-run OTP retrieval method documented for testers` —
  documented in `docs/SETUP.md §4`; nothing to do here.
- `[~] Maestro flows assume a signed-in state; document manual sign-in`
  — `maestro-testid-agent` is in flight on the testID layer; orchestrator
  should add a README to `e2e/maestro/` after that agent lands.

### §5 — Physical device test plan

- `[ ] iPhone SE (2nd gen) Bengali rendering verification` — pending,
  operator-side.
- `[ ] Dark-mode loading screen verified on device` — pending; depends
  on `theme-rollout-agent` finishing.
- `[ ] All five Maestro flows run manually if Cloud not configured` —
  pending; depends on `maestro-testid-agent`.
- `[ ] bKash deep link opens device app; Nagad fallback copies USSD` —
  pending, operator-side.
- `[ ] Airplane-mode add-expense → sync test` — pending, operator-side.
  WatermelonDB + Supabase sync is the hardest path to verify;
  `apps/mobile/src/features/offline/` exists and should be exercised.

### §6 — App Store metadata gaps

- `[~] Account deletion flow` — partial: stub in tree, real flow in
  flight via `account-delete-mobile-agent` and
  `account-delete-backend-agent`. **Not a TestFlight blocker; IS a
  public-App-Store-submission blocker.** See section A.
- `[ ] Privacy nutrition labels filled in App Store Connect`
  (phone linked, name linked, optional MFS numbers linked, Sentry
  crash unlinked) — pending, operator-side in App Store Connect.
- `[ ] Sign in with Apple reviewer note prepared` — text drafted in
  `docs/SETUP.md §6` and `docs/RELEASE_NOTES.md`; just needs to be
  copied into App Store Connect reviewer notes.
- `[ ] Reviewer notes: ledger-not-payments framing + demo OTP bypass
  account + demo data` — drafted; operator must paste into
  App Store Connect and provision the demo account.
- `[ ] Age rating 4+, Category Finance` — pending, App Store Connect.
- `[ ] Privacy policy + Support URL live` — pending. Per
  `docs/SETUP.md §129`, GitHub Pages is the recommended host;
  neither URL is committed in the repo today.
- `[ ] App version bumped from 0.1.0` — `app.config.ts` still reads
  `version: "0.1.0"`. For the first TestFlight upload bump to `0.2.0`
  (matches the multi-agent MVP wave in `RELEASE_NOTES.md`) and tag
  `v0.2.0` once merged; `release.yml` watches `v*` tags.

### Items that MUST resolve before the first TestFlight upload

1. Real `appleId` / `ascAppId` / `appleTeamId` in `eas.json` (via
   env vars / EAS Secrets, not committed).
2. `EAS_PROJECT_ID` set via `eas init`.
3. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set
   as EAS Secrets and pointing at the live (not local) project.
4. `supabase db push` against the live project so migrations
   `0001–0003` (plus any `0004` from `account-delete-backend-agent`)
   are applied.
5. `app.config.ts` version bumped from `0.1.0`.
6. Privacy policy + Support URL live and reachable.
7. Phone OTP provider configured server-side with a test number
   allow-listed.

### Items that can ship to TestFlight as-is, MUST land before public App Store submission

1. Real account-deletion flow replacing the `delete_coming_soon` stub.
2. `account_deletions` audit table (section A item 3).
3. Privacy nutrition labels + Reviewer Notes pasted into App Store
   Connect.
4. Demo OTP bypass account + seeded demo data for App Review.

## C. `pnpm db:check` runnability

### What `db:check` actually runs

- `package.json` (root) script: `"db:check": "pnpm --filter @baki/db test"`.
- `packages/db/package.json` `test` script:
  `"vitest --run --passWithNoTests"`.
- Vitest discovers `packages/db/tests/rls-policies.test.ts` and
  `packages/db/tests/rls-and-seed.test.ts`. Both files use the same
  pattern: a `checkReadiness()` function tries `psql --version` first,
  then falls back to `docker exec <supabase_db_container> psql`. If
  neither path connects to a Postgres on
  `postgresql://postgres:postgres@127.0.0.1:55322/postgres` (the
  Supabase local default), the whole `describe` block becomes
  `describe.skip` and the suite exits "green-with-warning."

So `pnpm db:check` will not *fail* in this environment — it will
**skip** the meaningful suite and print:
`[db tests] Skipping cross-user RLS suite: <reason>.`

That silent-skip is the dangerous part: CI may report green while
the RLS contract is unverified. Per
`docs/SETUP.md §2` the orchestrator must run `db:check` against a
real local stack before the TestFlight upload, not rely on CI.

### Environment inventory (this machine)

- `psql` — **NOT installed.** `command -v psql` returns nothing.
- `supabase` — installed: `/opt/homebrew/bin/supabase` v2.75.0 (a newer
  v2.100.1 is available; not critical).
- `docker` (CLI) — installed: `/usr/local/bin/docker` v29.4.2.
- `docker` daemon — **NOT running.** `docker info` fails with
  `failed to connect to the docker API at
  unix:///Users/muhammadyeasin/.docker/run/docker.sock`. The
  daemon socket is absent, which typically means Docker Desktop /
  Colima / OrbStack has not been started.

`supabase start` requires the Docker daemon. With it stopped, the
local stack cannot come up, so the `psql --dbname
postgresql://postgres:postgres@127.0.0.1:55322/postgres` path will
fail and the test suite will skip.

### Commands a human operator should run (in order)

Once Docker Desktop / Colima / OrbStack is running:

```bash
# 1. Bring Docker daemon up (operator picks one):
open -a Docker            # Docker Desktop
# or:   colima start
# or:   orbctl start

# 2. Sanity-check Docker is talking back:
docker info

# 3. Install psql so the host can drive the DB without docker exec:
brew install libpq && brew link --force libpq

# 4. Bring up the Supabase local stack (uses ./supabase/config.toml):
cd "/Volumes/IFMY/Baki - বাকি"
supabase start

# 5. Reset the local DB and apply every migration + seed:
supabase db reset --local
#   (Equivalent to `pnpm --filter db migrate:local`, which is
#   `supabase db reset` per packages/db/package.json line 13.)

# 6. Regenerate the typed schema so the mobile app's @baki/db
#    re-export sees the latest:
pnpm --filter db gen:types

# 7. Run the RLS test suite against the now-live local stack:
pnpm db:check
```

After step 7, expect the suite name in the vitest output to read
`local Supabase seed and RLS verification` (not the skipped
variant). If you still see `(skipped: ...)`, re-check that `psql`
is on `PATH` and that the Supabase containers listen on port
`55322` (`supabase status` will print the actual port — adjust
`DB_URL` env var if the operator's `config.toml` differs).

### Dependencies missing in this environment

| Dep | Why it matters | One-line install |
|---|---|---|
| Docker daemon | `supabase start` needs it | Launch Docker Desktop (`open -a Docker`) or `brew install --cask docker` if not present |
| `psql` | Host-driver path for the RLS suite | `brew install libpq && brew link --force libpq` |

The `docker exec` fallback in the test files looks for a container
named `supabase_db_Baki_-_` (note the project-name slug from
`./supabase/config.toml`). The test will pick the right container
**only if** Supabase is up and the local project name matches. If a
human operator already has psql installed they can skip the docker
exec fallback altogether.

### What I did NOT run

Per the audit constraints: I did not run `supabase start`,
`supabase db reset`, `pnpm install`, `pnpm db:check`,
`docker run`, or any mutating command. The above is the
prescribed sequence for the human operator only.
