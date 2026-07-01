# Mobile wave — features, screens, hooks

## A. Feature modules

- [x] `src/features/groups/types.ts`
- [x] `src/features/groups/use-groups.ts`
- [x] `src/features/groups/use-create-group.ts`
- [x] `src/features/groups/use-join-group.ts`
- [x] `src/features/groups/use-group-detail.ts`
- [x] `src/features/expenses/types.ts`
- [x] `src/features/expenses/split-math.ts`
- [x] `src/features/expenses/split-math.test.ts`
- [x] `src/features/expenses/use-expenses.ts`
- [x] `src/features/expenses/use-create-expense.ts`
- [x] `src/features/balances/use-balances.ts`
- [x] `src/features/balances/simplify-display.ts`
- [x] `src/features/balances/simplify-display.test.ts`
- [x] `src/features/settlement/use-create-settlement.ts`
- [x] `src/features/settlement/open-settlement.ts`
- [x] `src/features/auth/use-session.ts`

## B. Screens

- [x] `app/_layout.tsx` — registered new routes
- [x] `app/index.tsx` — auth-gate redirect
- [x] `app/(tabs)/_layout.tsx`
- [x] `app/(tabs)/index.tsx`
- [x] `app/(tabs)/balances.tsx`
- [x] `app/(tabs)/activity.tsx`
- [x] `app/(tabs)/settings.tsx`
- [x] `app/groups/create.tsx`
- [x] `app/groups/join.tsx`
- [x] `app/group/[id]/index.tsx`
- [x] `app/group/[id]/add-expense.tsx`
- [x] `app/group/[id]/settle.tsx`

## C. Verification

- [x] `pnpm --filter mobile typecheck` — 0 errors
- [x] `pnpm --filter mobile test` — 19 tests pass across 2 files
- [x] `pnpm --filter mobile lint` — 0 errors, 3 warnings (2 documented `any` for the RPC missing from generated types; 1 in the auto-generated router.d.ts)

## Review

This wave wires up the entire MVP user journey end-to-end: from auth gate, through the four-tab shell, into group creation/join, group detail, add-expense (all four split methods routed through pure math), and settle-up via bKash / Nagad / cash / other.

Key design decisions:

- Split math lives in `features/expenses/split-math.ts` as pure functions with `SplitMathError` codes; the only error message that ships to the user is the existing `expense.validation.shares_must_sum` key.
- `simplify-display.ts` projects `get_group_balances` rows into self-vs-other display rows (not the minimum-transfer plan; that stays on the server via `simplify_debts`).
- All Supabase calls have `// TODO(offline-watermelon)` placeholders where the local-DB hydration will plug in; writes already enqueue into the existing `enqueueMutation` queue on failure.
- The settle screen splits the caller's debt proportionally to creditor balances so the listed amounts always sum to the caller's net debt.
- Added `expo-clipboard` as a dependency so the Nagad USSD copy fallback works.
- Hand-patched `.expo/types/router.d.ts` because `experiments.typedRoutes` requires that file and Expo only regenerates it during `expo start`. The patch follows the existing format.

No new i18n keys were added; all visible strings use existing translations.
