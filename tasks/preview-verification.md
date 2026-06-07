# Preview verification — 2026-05-19

Read-only verification pass after the expo-go-runtime-audit, native-safe-abstraction,
mobile-preview, and dev-build-path agents landed (or attempted to land) their changes.

## Static checks

| Step | Command | Exit | Notes |
|---|---|---|---|
| Typecheck | `pnpm --filter mobile typecheck` | 0 | Clean (`tsc --noEmit`, no output). |
| Lint | `pnpm --filter mobile lint` | 0 | 1 pre-existing warning in `apps/mobile/.expo/types/router.d.ts` ("Unused eslint-disable directive"). Auto-generated file; not introduced by this wave. |
| Unit tests | `pnpm --filter mobile test` | 0 | 4 files / 24 tests pass. |
| i18n parity | `pnpm i18n:check` | 0 | 1 test passes. |

No new errors or warnings introduced.

## Wrapper presence

| File | Present? | Verdict |
|---|---|---|
| `apps/mobile/src/lib/expo-runtime.ts` | Yes | Exports `isExpoGo` from `Constants.executionEnvironment === ExecutionEnvironment.StoreClient`. |
| `apps/mobile/src/lib/sentry.ts` | Yes | Exports `Sentry` shim with `captureException` / `captureMessage` / `addBreadcrumb`. Native `@sentry/react-native` is `require()`d only when `!isExpoGo`. |
| `apps/mobile/src/lib/mmkv.ts` | Yes | Top-level `import { MMKV }` removed; native binding loaded inside `createNativeStorage()` via `require("react-native-mmkv")` behind the `!isExpoGo` branch. Memory fallback exported in Expo Go. |
| Stray direct Sentry imports | None | `grep -rn 'from "@sentry/react-native"' apps/mobile/{src,app} | grep -v '@sentry/react-native/expo'` returns zero. |
| Stray direct MMKV imports | None in app code | Only occurrence under `apps/mobile/{src,app}` is the gated `require()` inside `src/lib/mmkv.ts:25`. |

## `expo start --go`

Command run (no `timeout(1)` on macOS, so used background+kill at 35s):

```
pnpm exec expo start --go --host lan --port 8081
```

Hard failure before Metro started:

```
env: load .env.local
env: export EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_ENABLE_NAGAD EXPO_PUBLIC_ENABLE_BKASH
Starting project at /Volumes/IFMY/Baki - বাকি/apps/mobile
› [@sentry/react-native/expo] Missing config for organization, project. Environment variables will be used as a fallback during the build.
Starting Metro Bundler
Networking has been disabled
Unable to reach well-known versions endpoint. Using local dependency map expo/bundledNativeModules.json for version validation
Dependency validation is unreliable in offline-mode
CommandError: "expo-dev-client" is added as a dependency in your project's package.json but it doesn't seem to be installed. Please run "yarn" or "npm install" to fix this issue.
```

Root cause: `apps/mobile/package.json` lists `expo-dev-client@~5.0.0` (added by the
dev-build-path-agent) but `pnpm install` has not been re-run, so the package is absent
from `node_modules` and from `node_modules/.pnpm/`. No `exp://…` URL was printed.

Process was killed cleanly; no stray Metro process remains.

## `expo start --dev-client`

Command run, same kill pattern:

```
pnpm exec expo start --dev-client --host lan --port 8081
```

Got further than `--go` — Metro started:

```
env: load .env.local
env: export EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_ENABLE_NAGAD EXPO_PUBLIC_ENABLE_BKASH
› [@sentry/react-native/expo] Missing config for organization, project. Environment variables will be used as a fallback during the build.

Development build: Unable to get the default URI scheme for the project. Please make sure the expo-dev-client package is installed.
Starting project at /Volumes/IFMY/Baki - বাকি/apps/mobile
Starting Metro Bundler
Waiting on http://localhost:8081
Logs for your project will appear below.
```

Metro is bundling on `http://localhost:8081`, but no `exp://…` URL was printed because
the URI-scheme resolver also depends on `expo-dev-client` being installed. Same root
cause as `--go`. Process killed cleanly.

## Recommended preview command for the user

Neither flag works in the current tree because `expo-dev-client` is declared but not
installed. Until install is re-run, do **not** ship a preview command to the user.

After the orchestrator runs `pnpm install` once (a single `pnpm install` at the repo
root will materialise `expo-dev-client` and any other deps the in-flight agents added):

- **Recommended (lite preview):** `pnpm --filter mobile dev:go` — fastest path, exercises
  the Expo Go runtime branches we just verified (memory MMKV, no-op Sentry).
- **Fallback (full preview):** `pnpm --filter mobile dev:devclient` once the
  `development` profile `.ipa` has been built via `pnpm --filter mobile build:ios:devclient`
  and installed on the registered iPhone.

## Remaining blockers

- `pnpm install` has not been run since `expo-dev-client` was added to
  `apps/mobile/package.json`; both `expo start --go` and `expo start --dev-client`
  fail (the former hard, the latter silently swallowing the URI-scheme print) until
  it is. The orchestrator must invoke `pnpm install` (this agent is forbidden to)
  before re-running preview verification.
- `.env.local` points `EXPO_PUBLIC_SUPABASE_URL` at the local Supabase `http://127.0.0.1:55321`;
  any phone preview off the dev machine LAN will see the network call fail unless the
  mobile-preview-agent's empty-env tolerance ships or the env is repointed at a hosted
  Supabase. This does not block Metro/bundler startup, but blocks any real auth flow.
- `@sentry/react-native/expo` warns about missing org/project config on every Metro
  start; harmless for previews (the runtime is the no-op shim in Expo Go) but worth
  threading into EAS Secrets before the next preview build.
- Pre-existing lint warning in `apps/mobile/.expo/types/router.d.ts` is auto-generated
  and unrelated to this wave; leave alone.
