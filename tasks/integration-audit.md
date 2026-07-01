# Integration audit — post-outage wave

Forensic reconstruction of what each of the four parallel agents from the
previous wave actually landed. Three of four had their final reply truncated
mid-flight; this audit reads their file output to confirm what shipped and
what is missing.

Read-only audit. No source files were touched.

## Per-agent reconstruction

### 1. design-system-theme-agent (truncated reply)

- [x] `packages/ui/src/theme/useTheme.tsx` exists and exports
      `ThemeProvider`, `useTheme`, `ColorScheme`, `ThemeColors`,
      `ThemeContextValue`, `ThemeProviderProps`. The provider supports
      `override="light" | "dark" | "system"`, defaults to `"system"`, and
      falls back to `lightColors` outside a provider.
- [x] `packages/ui/src/theme/useTheme.test.tsx` exists with the three
      required cases (override `light`, override `dark`, no-provider
      fallback). Tests mock `react-native` and use `react-test-renderer`.
- [x] `packages/ui/src/theme/index.ts` re-exports `ThemeProvider`,
      `useTheme`, and all four type names.
- [x] `packages/ui/src/index.ts` re-exports `ThemeProvider`, `useTheme`,
      and the type union. **Bonus:** the index also surfaces previously
      missing exports for `AmountInput`, `BalancePill`, `LanguageToggle`,
      `MemberPickerRow`, and `MFSSettlementRow`. These were untracked
      component files that pre-existed but weren't wired through the barrel
      — the theme agent (or another wave) tidied them up at the same time.
- [x] `apps/mobile/app/_layout.tsx` imports `ThemeProvider` and
      `useTheme` from `@baki/ui`. The root tree wraps in `<ThemeProvider>`
      and a new `RootStack` subcomponent consumes `useTheme().colors` for
      `contentStyle.backgroundColor`, `headerStyle.backgroundColor`, and
      `headerTintColor`. The previous `#faf6ef` / `#0d1b1e` hardcodes are
      gone. Route registrations for `(tabs)`, `groups/create`, `groups/join`,
      `group/[id]/index`, `group/[id]/add-expense`, `group/[id]/settle` are
      all present.
- [x] `apps/mobile/app/index.tsx` no longer imports `lightColors`. The
      loading screen pulls `colors` from `useTheme()` and uses
      `colors.bgCanvas` and `colors.brandPrimary`. The screen is now a
      redirect gate (signed-in → `/(tabs)`, otherwise → `/(auth)/phone`),
      which is the intended Phase-1 behaviour.
- [x] Existing exports (`Money`, `Button`, `BalancePill`,
      `MFSSettlementRow`, etc.) are still listed in `packages/ui/src/index.ts`
      — no regressions.

**Net status:** complete and clean. No partial edits or orphans
attributable to this agent.

### 2. mobile-e2e-testid-agent (truncated reply)

- [x] `apps/mobile/app/(tabs)/_layout.tsx` adds `tabBarTestID` on all
      four tabs (`tab-groups`, `tab-balances`, `tab-activity`,
      `tab-settings`).
- [ ] **BLOCKER:** `tabBarTestID` is not in the expo-router `TabsProps`
      surface. `apps/mobile/.turbo/turbo-typecheck.log` shows four
      `TS2353: Object literal may only specify known properties, and
'tabBarTestID' does not exist in type 'TabsProps'` errors on lines
      31, 40, 49, 58 of `(tabs)/_layout.tsx`. Typecheck is red because of
      this. **This is the #1 issue for the orchestrator.** Standard fix is
      to wrap each `<Tabs.Screen>` `listeners` prop or push the testID into
      `tabBarButton` (`tabBarButton: (props) => <Pressable {...props}
testID="tab-groups" />`); alternative is to widen the type with a
      module-augmentation in a `*.d.ts`. Either is a one-file change.
- [x] `apps/mobile/app/group/[id]/settle.tsx` has `<View
testID={\`settle-row-${idx}\`}>` and `<View
  testID={\`settle-bkash-${idx}\`}>`plus extra`settle-nagad-{idx}`,
`settle-cash-{idx}`, `settle-other-{idx}`wrappers, plus the`settle-mark-paid-cta` Button testID. Wider coverage than the spec
      required.
- [x] `apps/mobile/app/group/[id]/index.tsx` carries
      `testID="settle-cta"` on the settle Pressable.
- [x] `apps/mobile/app/group/[id]/add-expense.tsx` carries
      `testID="expense-save-cta"` on the save Button.
- [x] `apps/mobile/app/(tabs)/index.tsx` carries
      `testID={\`group-card-${index}\`}` on each row.
- [x] `e2e/maestro/*.yaml` flows reference the new IDs:
  - `40-settle.yaml` taps `id: tab-balances`, `id: settle-row-0`,
    `id: settle-bkash-0`.
  - `30-view-balance.yaml` taps `id: tab-balances`.
  - `20-add-expense.yaml` taps `id: expense-save-cta`.
- [x] `e2e/maestro/README.md` includes the full testID table mapping
      each ID to its owning file and element. Includes a note that the
      `settle-*-{index}` IDs live on wrapper Views over the shared
      `MFSSettlementRow`.

**Gap:** `20-add-expense.yaml` taps `id: amount-input`, `id:
description-input`, `id: add-expense-fab`, and `10-create-group.yaml`
taps `id: group-name-input` — **none of these four testIDs exist
anywhere in `apps/mobile/`**. The README's testID table also does not
list them. These flows will silently fail to find the element and fall
back to (potentially flaky) text matching, or fail outright. Not a
blocker (flows are not in CI yet) but a real authoring gap.

**Net status:** the agent landed everything it was supposed to, _plus_
one TypeScript-incompatible prop that breaks `tsc`. Files are clean
otherwise — no half-written lines.

### 3. release-preflight-agent (truncated reply)

- [x] `docs/SETUP.md` gains a full "TestFlight preflight (Phase 4
      exit)" section appended after the existing troubleshooting cheatsheet.
      Includes:
  - Subsection 1: required EAS Secrets table (6 env vars, with the
    hard rule that `SUPABASE_SERVICE_ROLE_KEY` never ships in the mobile
    bundle).
  - Subsection 2: pre-build checklist (8 items, including running
    `gen:types` against the live Supabase and verifying migrations
    `0001`/`0002`/`0003` applied).
  - Subsection 3: build & submit command block, plus the explicit
    submission blocker on placeholder `appleId` / `ascAppId` /
    `appleTeamId` values still living in `apps/mobile/eas.json`.
  - Subsection 4: Dev Client + manual OTP step (native modules,
    Bangladeshi SMS provider notes, Maestro pre-signed-in assumption).
  - Subsection 5: physical-device test plan (iPhone SE minimum,
    dark-mode splash, Maestro local pass, bKash deep link, airplane
    mode).
  - Subsection 6: App Store metadata gaps with **account deletion
    flagged as a v1.0 blocker**, privacy nutrition labels, Sign in
    with Apple stance, reviewer notes, age rating + category.
- [x] `docs/RELEASE_NOTES.md` gets a new `0.2.1 — TestFlight
stabilization (2026-05-18)` entry at the top covering all four
      agents in this wave (theme, testID, types, preflight docs).
- [x] `apps/mobile/eas.json` left untouched (correct — secrets must
      not be committed).

**Drift in RELEASE_NOTES.md:** the bullet says the testIDs landed are
_"`tab-balances`, `settle-bkash-amount`, `settle-bkash-confirm`, and
the rest of the settlement happy path."_ The actual testIDs in source
are `settle-bkash-{index}` (no `amount` / `confirm` IDs exist anywhere
in the repo). The release-notes copy looks like it was drafted from
an earlier plan that mobile-e2e-testid-agent changed mid-flight.
Should be reworded to match reality.

**Net status:** docs landed cleanly. One copy-drift in the release
notes is the only nit.

### 4. db-types-rpc-agent (clean return, included here for completeness)

- [x] `packages/db/src/types.ts` regenerated with `get_group_balances`
      block (`Args: { p_group_id: string }`,
      `Returns: { net_paisa: number; user_id: string }[]`) in
      `Database["public"]["Functions"]`.
- [x] `packages/db/src/index.ts` derives `GroupBalanceRow` from
      `Database["public"]["Functions"]["get_group_balances"]["Returns"][number]`
      with a docblock referencing migration `0003_balances_helper.sql`.
- [x] `apps/mobile/src/features/balances/use-balances.ts` imports
      `GroupBalanceRow` from `@baki/db` and uses it as the return type of
      `fetchGroupBalances`. No `as any` remaining.

**Stale doc bullet:** `docs/DATA_MODEL.md` § "Type-generation note"
still says _"The generated `packages/db/src/types.ts` was produced
before `get_group_balances` existed. A human must run `pnpm --filter
db gen:types`..."_. That is now factually wrong — the regen has
happened and `get_group_balances` is in the file. Either rewrite the
note as "regenerated on 2026-05-18 against local Supabase; rerun
against the live project before TestFlight (see SETUP.md preflight)"
or delete it.

## Conflicts and collisions

- **No territory cross-pollination.** The theme agent did not touch
  `apps/mobile/app/(tabs)/_layout.tsx`. The testID agent did not touch
  `apps/mobile/app/_layout.tsx` or `apps/mobile/app/index.tsx`. Each
  agent stayed inside its lane.
- **Shared barrel file** (`packages/ui/src/index.ts`) was edited by the
  theme agent. The new exports (`AmountInput`, `BalancePill`,
  `LanguageToggle`, `MemberPickerRow`, `MFSSettlementRow`) are
  components that already existed as untracked files; nothing was lost
  or overwritten. Considered legitimate cleanup, not a collision.
- **`docs/RELEASE_NOTES.md`** is technically a shared surface
  (release-preflight-agent writes the entry, but the entry summarizes
  the testID and theme agents' work). The single-author drift on the
  testID names is the only artefact of that.

## Orphaned partials / missing outputs

- **`apps/mobile/.turbo/turbo-typecheck.log`** is checked in (or at
  least tracked under turbo's cache dir) and contains the failing
  `tabBarTestID` errors. Not an "orphan" exactly, but it confirms the
  agent never re-ran typecheck after editing `(tabs)/_layout.tsx`.
- **No half-written files** anywhere under `apps/mobile/`,
  `packages/ui/`, `packages/db/`, `docs/`, or `e2e/`. No stray
  `<<<<<<<`/`>>>>>>>` merge markers. No `// TODO(outage)` or
  `// FIXME(outage)` comments. All `// TODO(offline-watermelon)` lines
  in feature hooks are intentional (pre-existing offline-sync
  scaffolding).
- **Maestro flow gap (carried from § 2):** `group-name-input`,
  `amount-input`, `description-input`, `add-expense-fab` are taps
  inside `e2e/maestro/10-create-group.yaml` and
  `e2e/maestro/20-add-expense.yaml`, but no source file defines any
  of these testIDs. Listed below in the punch list.
- **Stale doc note (carried from § 4):** `docs/DATA_MODEL.md` § "Type
  generation note" claims the regen hasn't happened. It has.

## Punch list for the orchestrator

Ordered blocker → minor. Every item is a one-file (or one-region) edit.

1. **BLOCKER — `apps/mobile/app/(tabs)/_layout.tsx` (lines 31, 40, 49,
   58):** four `tabBarTestID` props produce `TS2353` because expo-router
   v4's `Tabs.Screen` options don't accept that key. Drop `tabBarTestID`
   from `options` and move the testID onto a `tabBarButton` render
   override:
   ```tsx
   <Tabs.Screen
     name="index"
     options={{
       …,
       tabBarButton: (props) => (
         <Pressable {...props} testID="tab-groups" />
       )
     }}
   />
   ```
   Repeat for `balances`, `activity`, `settings`. Maestro `id:` matching
   still hits the wrapper because hit testing falls through.
2. **`docs/RELEASE_NOTES.md` (lines 9–12, 0.2.1 entry):** rewrite the
   testID bullet to match reality — the IDs that shipped are
   `tab-groups`, `tab-balances`, `tab-activity`, `tab-settings`,
   `settle-cta`, `expense-save-cta`, `group-card-{index}`,
   `settle-row-{index}`, `settle-bkash-{index}`, `settle-nagad-{index}`,
   `settle-cash-{index}`, `settle-other-{index}`, `settle-mark-paid-cta`.
   The strings `settle-bkash-amount` and `settle-bkash-confirm` do not
   exist in source and should be removed.
3. **`docs/DATA_MODEL.md` § "Type-generation note" (lines 252–254):**
   the regen has happened; either replace the note with "regenerated
   2026-05-18 against local Supabase; rerun against live project
   before TestFlight" or delete it. Currently misleads any reader who
   greps for `get_group_balances`.
4. **`e2e/maestro/10-create-group.yaml` (line 12) and
   `e2e/maestro/20-add-expense.yaml` (lines 11, 13, 16, 19):** four
   referenced testIDs (`group-name-input`, `amount-input`,
   `description-input`, `add-expense-fab`) don't exist in source. Two
   options: (a) add the missing testIDs to `apps/mobile/app/groups/
create.tsx` and `apps/mobile/app/group/[id]/add-expense.tsx` (the
   `add-expense-fab` would go on the Plus Pressable in
   `apps/mobile/app/group/[id]/index.tsx`), or (b) change the flows to
   tap by visible Bengali label. Option (a) matches the testID-first
   convention this wave just landed.
5. **`docs/DATA_MODEL.md` § "Money column widths" (line 226):** prose
   nit unrelated to this wave but worth a one-line correction — the
   doc paragraph at the top of the file says "All money columns:
   `integer` (paisa)" while the implementation status section says it
   should be `bigint`. Bring the top-of-file convention bullet in line
   with the bigint reality.

## All clear?

**No.** One blocker (item 1) holds `pnpm typecheck` red and therefore
blocks the orchestrator from running release-preflight gates. Items
2–5 are documentation drift and Maestro authoring gaps that don't
block TestFlight but should land in the same follow-up wave.
