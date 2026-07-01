# DATA_MODEL.md

> Source of truth for the Supabase schema. Every schema change starts here, then becomes a migration in `packages/db/migrations/`.

## Conventions

- All tables in `public` schema
- All money columns: `integer` (paisa), NOT NULL, CHECK `>= 0`
- All timestamps: `timestamptz`, default `now()`
- All primary keys: `uuid`, default `gen_random_uuid()`
- All tables have `created_at` and `updated_at`; trigger updates `updated_at` on every UPDATE
- Soft delete via `deleted_at timestamptz` where applicable; never hard-delete user-visible data

## Tables

### `profiles`

Mirrors `auth.users` with public-safe fields.

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  phone text not null,
  avatar_url text,
  default_currency text not null default 'BDT',
  locale text not null default 'bn' check (locale in ('bn', 'en')),
  bkash_number text,             -- optional, encrypted at app layer
  nagad_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `groups`

A খাতা.

```sql
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  template text not null check (template in ('mess','family','trip','event','custom')),
  avatar_url text,
  invite_code text unique not null default substr(md5(random()::text), 1, 6),
  created_by uuid not null references public.profiles(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `group_members`

Join table.

```sql
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id)
);
```

### `expenses`

```sql
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  amount_paisa bigint not null check (amount_paisa > 0),
  description text not null check (char_length(description) between 1 and 200),
  category text not null check (category in (
    'food','rent','utility','transport','entertainment',
    'shopping','medical','education','gift','other'
  )),
  paid_by uuid not null references public.profiles(id),
  split_method text not null check (split_method in ('equal','exact','percent','shares')),
  occurred_at timestamptz not null default now(),
  note text,
  receipt_url text,
  client_mutation_id text,
  created_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.expenses (group_id, occurred_at desc);
create unique index on public.expenses (group_id, created_by, client_mutation_id)
  where client_mutation_id is not null;
```

### `expense_shares`

One row per (expense, member) describing how the expense splits.

```sql
create table public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  share_paisa bigint not null check (share_paisa >= 0),
  primary key (expense_id, user_id)
);
```

Invariant (enforced by trigger): `sum(share_paisa) for an expense = expenses.amount_paisa`.

### `settlements`

A payment between two members that zeroes or reduces a balance.

```sql
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount_paisa bigint not null check (amount_paisa > 0),
  method text not null check (method in ('bkash','nagad','cash','other')),
  external_ref text,
  client_mutation_id text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

### `activity_log`

Append-only feed.

```sql
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null check (event_type in (
    'expense_added','expense_edited','expense_deleted',
    'settled','member_joined','member_left','group_renamed'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.activity_log (group_id, created_at desc);
```

### `device_tokens`

For Expo push.

```sql
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_token text not null,
  platform text not null check (platform in ('ios','android')),
  last_seen_at timestamptz not null default now(),
  unique (user_id, expo_token)
);
```

## Row Level Security

**Every table has RLS enabled.** Default deny.

### `profiles`

- SELECT: a user can read their own profile, and profiles of users who share at least one group with them
- INSERT/UPDATE: only own row

### `groups`

- SELECT: only groups where the user is in `group_members` and `left_at is null`
- INSERT: any authenticated user (creator)
- UPDATE: only if user is admin of the group
- DELETE: only if user is creator AND no unsettled balances exist (enforced by edge function, not raw delete)

### `group_members`

- SELECT: users can see members of groups they belong to
- INSERT: only via `accept_invite` edge function (which validates invite_code)
- UPDATE: only own row (to set `left_at`)

### `expenses`, `expense_shares`, `settlements`, `activity_log`

- SELECT: only if user is a current member of the expense's `group_id`
- INSERT/UPDATE: only by current group members; `created_by` must equal `auth.uid()`

### `device_tokens`

- ALL: only own rows

## Database functions

### `simplify_debts(group_id uuid) returns table(...)`

Given a group, computes net balances and returns the minimum-transaction settlement plan. Implemented in PL/pgSQL with a greedy algorithm (creditors and debtors sorted, largest matched first).

### `accept_invite(invite_code text) returns uuid`

- Validates code, inserts into `group_members`, logs `member_joined` event, returns `group_id`
- Security definer; bypasses RLS to perform the insert, but checks `invite_code` validity strictly

### `create_expense(...) returns uuid`

Atomic expense writer used by the mobile app.

- Signature: `create_expense(p_group_id uuid, p_amount_paisa bigint, p_description text, p_category text, p_paid_by uuid, p_split_method text, p_shares jsonb, p_occurred_at timestamptz default now(), p_note text default null, p_receipt_url text default null, p_client_mutation_id text default null) returns uuid`
- `p_shares` is a JSON object keyed by member UUID: `{ "<user_id>": <share_paisa> }`
- `p_client_mutation_id` is optional. When present, retries for the same `group_id`, caller, and client mutation id return the existing expense id instead of inserting another expense or duplicate share rows.
- Requires `auth.uid()`; raises `not_authenticated` (`28000`) for anonymous callers
- Verifies the caller is a current group member; raises `not_group_member` (`42501`) otherwise
- Verifies `p_paid_by` is a current group member; raises `paid_by_not_group_member` (`42501`) otherwise
- Verifies every share user is a current group member; raises `split_user_not_group_member` (`42501`) otherwise
- Verifies all share values are non-negative integer paisa and sum exactly to `p_amount_paisa`; raises `split_total_mismatch` (`23514`) if the total is wrong
- Inserts the parent `expenses` row and all `expense_shares` rows in one Postgres transaction. The existing `expenses_log_activity` trigger writes the `activity_log` row in that same transaction.
- `SECURITY INVOKER`; normal table RLS still applies. `EXECUTE` is revoked from `public`/`anon` and granted only to `authenticated`.

### `create_settlement(...) returns uuid`

Atomic settlement writer used by the mobile app.

- Signature: `create_settlement(p_group_id uuid, p_from_user uuid, p_to_user uuid, p_amount_paisa bigint, p_method text, p_external_ref text default null, p_occurred_at timestamptz default now(), p_client_mutation_id text default null) returns uuid`
- `p_client_mutation_id` is optional. When present, retries for the same `group_id`, `from_user`, and client mutation id return the existing settlement id instead of inserting another settlement or duplicate activity row.
- Requires `auth.uid()`; raises `not_authenticated` (`28000`) for anonymous callers
- Verifies the caller is a current group member; raises `not_group_member` (`42501`) otherwise
- Verifies both settlement parties are current group members; raises `from_user_not_group_member` or `to_user_not_group_member` (`42501`) otherwise
- Verifies the caller is one side of the settlement; raises `settlement_party_required` (`42501`) otherwise
- Verifies `p_from_user` and `p_to_user` are different, `p_amount_paisa` is positive, and `p_method` is one of `bkash`, `nagad`, `cash`, or `other`
- Inserts the `settlements` row in one Postgres transaction. The existing `settlements_log_activity` trigger writes the `settled` `activity_log` row in that same transaction.
- `SECURITY INVOKER`; normal table RLS still applies. `EXECUTE` is revoked from `public`/`anon` and granted only to `authenticated`.

## Triggers

- `set_updated_at` on every table with `updated_at` column
- `enforce_share_sum` on `expense_shares` — ensures sum equals expense amount
- `log_activity` on `expenses` (INSERT/UPDATE/DELETE) and `settlements` (INSERT) — appends to `activity_log`

## Realtime

Enable Supabase Realtime on:

- `expenses`
- `expense_shares`
- `settlements`
- `activity_log`
- `group_members`

Clients subscribe per-group; the mobile app filters by `group_id = $current_group`.

## Indexes (beyond PKs)

- `groups(invite_code)` — already unique
- `expenses(group_id, occurred_at desc)`
- `expenses(group_id, created_by, client_mutation_id) where client_mutation_id is not null` — idempotent mobile retries
- `expense_shares(user_id)` — for "all my balances" view
- `settlements(group_id, occurred_at desc)`
- `settlements(group_id, from_user, client_mutation_id) where client_mutation_id is not null` — idempotent mobile settlement retries
- `activity_log(group_id, created_at desc)`
- `group_members(user_id) where left_at is null`

## Implementation status

This section tracks divergences between the prose schema above and the actual migrations under `packages/db/migrations/`. Append, do not silently rewrite.

### Money column widths

The doc text above says "money columns: `integer` (paisa)". The shipped migration `0001_initial.sql` uses **`bigint`** for `expenses.amount_paisa`, `expense_shares.share_paisa`, and `settlements.amount_paisa`, which matches the project-wide non-negotiable "money is bigint paisa". The doc prose is the drift; treat the migration as authoritative. New columns must follow `bigint`.

### `group_members` INSERT

There is intentionally **no `INSERT` policy on `group_members`**. The only path that adds rows is the `accept_invite(p_invite_code text)` PL/pgSQL function, which is `SECURITY DEFINER` and validates the invite code before inserting. The group-creator membership row is added by the `add_group_creator_member` trigger, also `SECURITY DEFINER`. RLS default-deny on INSERT is therefore the desired behaviour and is now covered by an RLS test (`packages/db/tests/rls-policies.test.ts`).

### `settlements` UPDATE / DELETE

`0001_initial.sql` defines only `SELECT` and `INSERT` policies on `public.settlements`. No `UPDATE` or `DELETE` policy exists, so default-deny applies to both. This is intentional — settlements are append-only ledger entries; corrections happen by inserting a compensating settlement. Covered by an RLS test.

### `expense_shares` DELETE

Only `SELECT`, `INSERT`, and `UPDATE` policies are defined for `public.expense_shares`. `DELETE` is default-deny — share rows are removed only as a side-effect of the parent expense being soft-deleted (the trigger leaves shares intact for audit). If we ever need an explicit `DELETE` path, add it in a follow-up migration with a new RLS test.

### Group archive / rename

The doc prose says "UPDATE: only if user is admin of the group". This is enforced by `groups_update_admins`, which is `FOR UPDATE` and gates both `using` and `with check` on `current_user_is_group_admin(id)`. Archive (`archived_at`) and rename (`name`) both go through this single policy — no extra policy needed.

### `device_tokens`

`device_tokens_own_rows` is `FOR ALL` (SELECT/INSERT/UPDATE/DELETE) gated to `user_id = auth.uid()`. The doc bullet ("ALL: only own rows") matches the migration.

### Database functions added since 0001

- `get_group_balances(p_group_id uuid) returns table(user_id uuid, net_paisa bigint)` — added in `0003_balances_helper.sql`. `SECURITY DEFINER`, raises `not_group_member` (SQLSTATE `42501`) if the caller is not a current member. Returns one row per member who has a non-zero net (creditor positive, debtor negative). The mobile app uses this for the per-member balance strip without re-running `simplify_debts`.
- `create_expense(...) returns uuid` — added in `20260630230837_create_expense_rpc.sql` and made idempotent in `20260630235302_retry_safe_money_rpc.sql`. `SECURITY INVOKER`, raises `not_authenticated` (`28000`) for anon callers, `not_group_member` / `paid_by_not_group_member` / `split_user_not_group_member` (`42501`) for membership failures, and `split_total_mismatch` (`23514`) when shares do not sum to the expense amount. Returns the inserted expense UUID, or the existing UUID for a retry with the same non-null client mutation id.
- `create_settlement(...) returns uuid` — added in `20260630235302_retry_safe_money_rpc.sql` and made idempotent in `20260701073918_settlement_idempotency_and_queue_replay.sql`. `SECURITY INVOKER`, validates caller membership, settlement parties, amount, method, and party participation before inserting the settlement. The `settlements_log_activity` trigger writes the `settled` event in the same transaction. Returns the inserted settlement UUID, or the existing UUID for a retry with the same non-null client mutation id.

### Type-generation note

`packages/db/src/types.ts` is regenerated against a local Supabase with all migrations applied (`0001`–`0004`, `20260630230837_create_expense_rpc`, `20260630235302_retry_safe_money_rpc`, and `20260701073918_settlement_idempotency_and_queue_replay` as of 2026-07-01). `Database["public"]["Functions"].get_group_balances`, `Database["public"]["Functions"].delete_my_account`, `Database["public"]["Functions"].create_expense`, and `Database["public"]["Functions"].create_settlement` are present and typed. `GroupBalanceRow` in `packages/db/src/index.ts` is derived from that generated type, so the mobile app calls `supabase.rpc("get_group_balances", { p_group_id })` against the typed client with no casts. Re-run `pnpm --filter db gen:types` after any new migration that touches a table, enum, relationship, function, or return shape.

## Account deletion

Apple Guideline 5.1.1(v) requires an in-app deletion path before the App Store submission. This section is the source of truth for what that path does on the server. The mobile-side hook (`apps/mobile/src/features/auth/`) calls this contract; do not change the wire shape without also updating the mobile agent.

### Wire contract

- **Edge Function name:** `delete-account`
- **Method:** `POST`
- **Request body:** `{}` — the user's identity is taken from the Supabase JWT in the `Authorization: Bearer <token>` header. No other inputs are accepted.
- **Success response:** HTTP `200` with JSON body `{ "deleted": true }`. After this, the client must `supabase.auth.signOut()` locally; the server has already invalidated the session as a side-effect of removing the `auth.users` row.
- **Failure response:** HTTP `4xx`/`5xx` with JSON body `{ "error": "<machine_code>" }`. Localized strings live in `packages/i18n`; the function returns codes only.

### Error codes

| Code                 | HTTP | Meaning                                                                                                                                                                                        |
| -------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `not_authenticated`  | 401  | No valid JWT was attached. The client must redirect to the OTP flow.                                                                                                                           |
| `method_not_allowed` | 405  | A caller used anything other than `POST`. The mobile app should never hit this.                                                                                                                |
| `unsettled_balances` | 409  | The user has a non-zero net balance in at least one active group. The client surfaces "settle up first" and lists the offending groups (the client already has balances locally).              |
| `internal_error`     | 500  | Catch-all. The function logs the raw error to its own Deno logs (never phone numbers or MFS numbers — `maskMfsNumber` from `@baki/payments` is used if anything resembling a phone is logged). |

### Cascade behavior

`public.profiles.id` is `references auth.users(id) on delete cascade` (see `0001_initial.sql`). When we delete a row from `auth.users`, Postgres cascades through `public.profiles`, and from there cascades into:

- `public.group_members` — `user_id ... on delete cascade`
- `public.device_tokens` — `user_id ... on delete cascade`
- `public.expense_shares` — `expense_id ... on delete cascade` only cascades when the parent **expense** is deleted; it does not cascade when the user is deleted, because `expense_shares.user_id` has **no** `on delete` clause. We address this below.

The following FK columns reference `public.profiles(id)` **without** `on delete cascade`, so a naive cascade would fail or orphan data:

- `expenses.paid_by`
- `expenses.created_by`
- `settlements.from_user`
- `settlements.to_user`
- `activity_log.actor_id`
- `expense_shares.user_id`

These rows belong to other group members' ledgers; deleting them would corrupt every co-member's balance. We therefore reassign these references to a sentinel "tombstone" profile rather than dropping them.

### Tombstone profile

A singleton row in `public.profiles` represents "[deleted user]". Its UUID is the all-zeros UUID `00000000-0000-0000-0000-000000000000`. It is inserted by `0004_account_deletion.sql` with `on conflict (id) do nothing` so the migration is idempotent. It is **not** backed by an `auth.users` row — the FK from `profiles.id -> auth.users.id` is created with `on delete cascade`, but Postgres allows the child row to exist without a parent only if we insert the child without a matching parent (the constraint is not deferred). For that reason the migration first inserts a stub `auth.users` row for the tombstone (`aud = 'authenticated'`, `role = 'authenticated'`, phone `+00000000000`, email `deleted@baki.invalid`, dummy encrypted password, `email_confirmed_at` set), and then inserts the matching `profiles` row. The stub user has no usable credentials — its password hash is meaningless and SMS/email confirmation is set so OTP cannot be initiated against it.

The mobile app must filter the tombstone out of any "member list" UI. Its `display_name` is the literal string `[deleted user]`, which the renderer maps via `i18n` to the localized "মুছে ফেলা ব্যবহারকারী" / "Deleted user".

### Unsettled-balance check

Deletion is refused if the user has any non-zero net in any active (non-archived, non-soft-deleted) group. The check reuses the existing `get_group_balances` data flow rather than recomputing it. Specifically: the RPC `public.delete_my_account()` iterates over every group the caller is a current member of (`group_members.left_at is null` AND `groups.archived_at is null` AND `groups.deleted_at is null`), and for each one computes the caller's net the same way `get_group_balances` does. If any net is non-zero, the function raises `unsettled_balances` (SQLSTATE `P0001`) and the Edge Function translates that to HTTP 409 + `{ error: "unsettled_balances" }`.

A user with a zero net in every group is allowed to delete even if the group still has outstanding balances between **other** members; their own ledger is clean.

### RPC contract — `public.delete_my_account()`

Added in `0004_account_deletion.sql`:

- `SECURITY DEFINER`, owned by the Postgres role.
- Raises `not_authenticated` (SQLSTATE `28000`) if `auth.uid()` is null.
- Raises `unsettled_balances` (SQLSTATE `P0001`) if any active-group net is non-zero.
- Reassigns the six FK columns listed above from the caller's UUID to the tombstone UUID inside a single transaction. Each `UPDATE` is scoped on `... = auth.uid()` so the function cannot touch other users' rows even by mistake.
- Deletes the row from `auth.users where id = auth.uid()`. The cascade from `auth.users -> public.profiles -> (group_members, device_tokens)` removes the caller's identity and push tokens.
- Returns `void`.
- `EXECUTE` is revoked from `anon` and granted to `authenticated`.

The Edge Function at `supabase/functions/delete-account/index.ts` never deletes rows directly; it only calls this RPC with the user's JWT and translates SQL errors into the wire-level `error` codes.

### Re-deletion idempotency

If the same authenticated session calls the Edge Function twice, the second call will fail at `auth.uid()` (the session is invalidated after the first call removed the `auth.users` row) and return `not_authenticated`. From the user's perspective both calls produce the desired "I am signed out" state, so the client treats `not_authenticated` after a `deleted: true` as a no-op.
