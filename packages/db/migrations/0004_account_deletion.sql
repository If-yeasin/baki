-- 0004_account_deletion.sql
--
-- Implements the Apple Guideline 5.1.1(v) account-deletion path on the server.
-- See `docs/DATA_MODEL.md` ("Account deletion") for the prose contract and the
-- list of FK columns reassigned to the tombstone.
--
-- What this migration adds:
--
--   1. A singleton "tombstone" profile (UUID `00000000-0000-0000-0000-000000000000`)
--      that owns the ledger rows left behind by deleted users so co-members'
--      balances are preserved. Inserted with `on conflict do nothing` so the
--      migration is safe to re-run.
--
--   2. `public.delete_my_account()` — a SECURITY DEFINER RPC the Edge Function
--      `delete-account` calls with the user's JWT context. It:
--
--        - rejects unauthenticated callers (errcode `28000`);
--        - rejects callers with any non-zero net balance in any active group
--          (errcode `P0001`, message `unsettled_balances`);
--        - reassigns `expenses.paid_by`, `expenses.created_by`,
--          `settlements.from_user`, `settlements.to_user`,
--          `activity_log.actor_id`, and `expense_shares.user_id` from the
--          caller's UUID to the tombstone UUID; and
--        - deletes the matching `auth.users` row, letting the existing
--          ON DELETE CASCADE chain (profiles -> group_members, device_tokens)
--          do the rest.
--
--   3. EXECUTE is revoked from `anon`; granted to `authenticated` only.
--
-- The Edge Function itself is NOT part of this migration — this file is the
-- SQL contract. The function lives under `supabase/functions/delete-account/`.

set search_path = public;

-- 1. Tombstone profile.
--
-- `public.profiles.id` is a FK to `auth.users(id)` with ON DELETE CASCADE, so
-- the tombstone needs a matching `auth.users` row. The row is a stub with
-- unreachable credentials: a meaningless password hash, an
-- `@baki.invalid` email that the SMTP layer cannot deliver to, and an
-- impossible phone number. Email and phone are pre-confirmed to make Supabase
-- treat the user as "fully signed up" so it never tries to send a
-- confirmation OTP to the dummy phone.

do $$
declare
  tombstone_id constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if not exists (select 1 from auth.users where id = tombstone_id) then
    insert into auth.users (
      id,
      aud,
      role,
      email,
      phone,
      encrypted_password,
      email_confirmed_at,
      phone_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_super_admin
    ) values (
      tombstone_id,
      'authenticated',
      'authenticated',
      'deleted@baki.invalid',
      '+00000000000',
      -- A bcrypt-formatted but unusable hash. Anything starting with `$2a$` is
      -- treated as bcrypt by Supabase Auth; this specific string is not the
      -- hash of any practical password.
      '$2a$10$baki.tombstone.unusable.password.hash.placeholder.value0',
      now(),
      now(),
      '{"provider":"phone","providers":["phone"],"baki_tombstone":true}'::jsonb,
      '{"baki_tombstone":true}'::jsonb,
      now(),
      now(),
      false
    );
  end if;
end
$$;

insert into public.profiles (
  id,
  display_name,
  phone,
  locale,
  default_currency
) values (
  '00000000-0000-0000-0000-000000000000',
  '[deleted user]',
  '+00000000000',
  'en',
  'BDT'
)
on conflict (id) do nothing;

comment on column public.profiles.id is
  'FK to auth.users(id). The all-zeros UUID is reserved as the "tombstone" '
  'profile and is inserted by 0004_account_deletion.sql; ledger rows from '
  'deleted users are reassigned to it so co-members'' balances are preserved.';

-- 2. delete_my_account()
--
-- This RPC is the only writer that performs the reassignment + cascade.
-- It is SECURITY DEFINER (so it can write to other users'' ledger rows
-- transitively via the reassignment), but every write is scoped on
-- `auth.uid()` — the caller can only ever affect their own identity.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_id uuid;
  tombstone_id constant uuid := '00000000-0000-0000-0000-000000000000';
  active_group record;
  caller_net bigint;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if caller_id = tombstone_id then
    -- Defensive: do not let anyone (even via JWT spoofing) erase the
    -- tombstone identity. The ledger reassignment target must always exist.
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 2a. Unsettled-balance check.
  --
  -- For every active group the caller is a current member of, compute the
  -- caller's net the same way `get_group_balances` does (expenses paid -
  -- expense shares + settlements paid - settlements received). If any net
  -- is non-zero we abort. We do not call get_group_balances directly
  -- because it returns rows for every member; here we only care about
  -- whether the caller's own net is zero, which is faster as a scalar
  -- query.
  for active_group in
    select g.id
    from public.groups g
    join public.group_members gm on gm.group_id = g.id
    where gm.user_id = caller_id
      and gm.left_at is null
      and g.archived_at is null
      and g.deleted_at is null
  loop
    select coalesce(sum(delta_paisa), 0)::bigint
    into caller_net
    from (
      select e.amount_paisa as delta_paisa
      from public.expenses e
      where e.group_id = active_group.id
        and e.deleted_at is null
        and e.paid_by = caller_id

      union all

      select -es.share_paisa as delta_paisa
      from public.expense_shares es
      join public.expenses e on e.id = es.expense_id
      where e.group_id = active_group.id
        and e.deleted_at is null
        and es.user_id = caller_id

      union all

      select s.amount_paisa as delta_paisa
      from public.settlements s
      where s.group_id = active_group.id
        and s.from_user = caller_id

      union all

      select -s.amount_paisa as delta_paisa
      from public.settlements s
      where s.group_id = active_group.id
        and s.to_user = caller_id
    ) as deltas;

    if caller_net <> 0 then
      raise exception 'unsettled_balances' using errcode = 'P0001';
    end if;
  end loop;

  -- 2b. Reassign FK columns that lack ON DELETE CASCADE.
  --
  -- Every UPDATE scopes on the caller's UUID. There is no `where true`,
  -- so even if `caller_id` were somehow wrong the worst case is a no-op.

  update public.expenses
  set paid_by = tombstone_id
  where paid_by = caller_id;

  update public.expenses
  set created_by = tombstone_id
  where created_by = caller_id;

  update public.settlements
  set from_user = tombstone_id
  where from_user = caller_id;

  update public.settlements
  set to_user = tombstone_id
  where to_user = caller_id;

  update public.activity_log
  set actor_id = tombstone_id
  where actor_id = caller_id;

  update public.expense_shares
  set user_id = tombstone_id
  where user_id = caller_id;

  -- 2c. Drop the auth.users row. The existing FK
  -- `profiles.id -> auth.users.id on delete cascade` will remove the public
  -- profile, which in turn cascades through `group_members` and
  -- `device_tokens`. Sessions are invalidated as a side-effect of the
  -- `auth.users` row disappearing.

  delete from auth.users where id = caller_id;
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the calling user''s account per Apple Guideline 5.1.1(v). Reassigns '
  'ledger FKs (expenses.paid_by, expenses.created_by, settlements.from_user, '
  'settlements.to_user, activity_log.actor_id, expense_shares.user_id) to the '
  'tombstone profile (00000000-0000-0000-0000-000000000000) and deletes the '
  'auth.users row, which cascades to profiles, group_members, and '
  'device_tokens. Raises `not_authenticated` (28000) for anon callers and '
  '`unsettled_balances` (P0001) when any active-group net is non-zero. '
  'SECURITY DEFINER; called only by the `delete-account` Edge Function with '
  'the user''s JWT.';

revoke execute on function public.delete_my_account() from public;
revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
