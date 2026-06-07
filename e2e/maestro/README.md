# Maestro E2E Flows

Critical-path flows for the বাকি (Baki) iOS app. Designed for the iOS Simulator
running a Dev Client build (or a TestFlight preview build installed on a device).

## Install Maestro

```bash
brew install maestro-cli
```

## Setup before running flows

These flows assume a signed-in user on the home screen. Run through this list once
before executing any of the numbered flows.

1. **Install Maestro** (see section above — `brew install maestro-cli`).
2. **Install Expo CLI.** If you don't already have it globally, use one of:
   ```bash
   # Global install (only if not already present)
   npm i -g expo-cli

   # Or invoke without installing globally
   pnpm dlx expo --version
   ```
3. **Build and install the iOS Dev Client onto the Simulator.** The Dev Client
   is required for any flow that touches native modules (camera, contacts,
   bKash deep links). Pick one of:
   ```bash
   # Full native build via EAS (recommended once per native-deps change)
   pnpm --filter mobile exec expo prebuild --platform ios
   eas build --profile development --platform ios --local

   # Faster JS-only path — opens the Simulator with the bundled Expo Go client.
   # NOTE: this WILL NOT include custom native modules; Dev Client is required
   # for flows 20–40 to fully exercise the app.
   pnpm --filter mobile dev   # then press `i` to open in the iOS Simulator
   ```
4. **Manual OTP sign-in (first run only).** Phone OTP cannot be automated
   reliably in CI, so the first time you run these flows you must sign in by
   hand:
   - Tap the **+880** phone field on the launch screen.
   - Enter a test number (e.g. `1700000000`).
   - Read the one-time code from Supabase Studio under
     **Authentication → Users → audit logs** for that user, or use a Supabase
     Auth dev user that has been seeded with a pre-confirmed OTP.
   - Complete the profile (name + preferred language).

   Flows `10-create-group.yaml` through `40-settle.yaml` all assume you start
   from the signed-in home screen.

### Reset state between runs

To get back to a clean signed-in baseline (without redoing OTP), launch the app
fresh and uninstall the binary to wipe local state:

```bash
maestro test --shard 1 e2e/maestro/00-launch.yaml
xcrun simctl uninstall booted com.baki.app
```

Reinstall the Dev Client and sign in again as described in step 4.

## Run all flows

```bash
# 1. Start the dev server in another shell
pnpm --filter mobile dev

# 2. Boot an iOS Simulator with the app already installed (Dev Client),
#    sign in via phone OTP manually, then:
maestro test e2e/maestro
```

## Run a single flow

```bash
maestro test e2e/maestro/10-create-group.yaml
```

## Flow inventory

| File | What it verifies |
| --- | --- |
| `00-launch.yaml` | App launches and renders the Bengali brand text |
| `10-create-group.yaml` | Create-khata flow with trip template |
| `20-add-expense.yaml` | Add an expense, see Bengali numerals render |
| `30-view-balance.yaml` | Per-group balances tab shows owe/owed state |
| `40-settle.yaml` | bKash settlement deep link (needs bKash installed; skip in CI) |

## CI

These flows are not run in GitHub Actions today — Maestro Cloud or a macOS
runner with the simulator preconfigured is required. Run locally before
tagging a release.

**CI must not include `40-settle.yaml` until a bKash mock URL handler is
added.** The settle flow opens the real bKash native app via a `bkash://`
deep link, which is non-deterministic in cloud simulators (no bKash binary
exists there) and depends on a real merchant sandbox account. Until we ship a
test-only URL interceptor that fakes the bKash callback, this flow is
local-and-device-only and tagged `ci-skip`.

## Required app testIDs

These testIDs are wired into the app screens so Maestro flows can target
elements without depending on fragile Bengali copy. When adding new flows,
prefer `id:` selectors over `text:` selectors and add new testIDs here.

| testID | Screen | Element |
| --- | --- | --- |
| `tab-groups` | `app/(tabs)/_layout.tsx` | Groups tab (bottom nav) |
| `tab-balances` | `app/(tabs)/_layout.tsx` | Balances tab (bottom nav) |
| `tab-activity` | `app/(tabs)/_layout.tsx` | Activity tab (bottom nav) |
| `tab-settings` | `app/(tabs)/_layout.tsx` | Settings tab (bottom nav) |
| `group-card-{index}` | `app/(tabs)/index.tsx` | Group card in the groups list |
| `group-name-input` | `app/groups/create.tsx` | Khata name Input on the create-group screen |
| `settle-cta` | `app/group/[id]/index.tsx` | "Settle up" Pressable on the group detail screen |
| `add-expense-fab` | `app/group/[id]/index.tsx` | "Add expense" Pressable (FAB) on the group detail screen |
| `amount-input` | `app/group/[id]/add-expense.tsx` | Amount AmountInput on the add-expense form |
| `description-input` | `app/group/[id]/add-expense.tsx` | Description Input on the add-expense form |
| `expense-save-cta` | `app/group/[id]/add-expense.tsx` | Save Button on the add-expense form |
| `settle-row-{index}` | `app/group/[id]/settle.tsx` | Creditor card wrapper on the settle screen |
| `settle-bkash-{index}` | `app/group/[id]/settle.tsx` | bKash settlement row wrapper |
| `settle-nagad-{index}` | `app/group/[id]/settle.tsx` | Nagad settlement row wrapper |
| `settle-cash-{index}` | `app/group/[id]/settle.tsx` | Cash settlement row wrapper |
| `settle-other-{index}` | `app/group/[id]/settle.tsx` | "Other" settlement row wrapper |
| `settle-mark-paid-cta` | `app/group/[id]/settle.tsx` | "Mark as paid" confirmation Button |

Note: the `settle-*-{index}` testIDs live on a wrapper `<View>` around the
shared `MFSSettlementRow` component (owned by `packages/ui`). Maestro's hit
testing falls through to the inner pressable, so this indirection is invisible
to flows.
