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
  created_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.expenses (group_id, occurred_at desc);
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

### `create_expense(...)` (optional, in v1.5)
Wraps insert into `expenses` + `expense_shares` + `activity_log` in a single transaction with validation.

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
- `expense_shares(user_id)` — for "all my balances" view
- `settlements(group_id, occurred_at desc)`
- `activity_log(group_id, created_at desc)`
- `group_members(user_id) where left_at is null`
