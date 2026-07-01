-- 0006_retry_safe_money_rpc.sql
--
-- Makes mobile money writes safer for offline replay and network retries.
-- Expense creation gains a client mutation id so retries return the original
-- expense instead of duplicating the parent row and shares. Settlement creation
-- moves behind a validating RPC while preserving normal table RLS.

set search_path = public;

alter table public.expenses
add column if not exists client_mutation_id text;

comment on column public.expenses.client_mutation_id is
  'Optional client-generated mutation id used to make create_expense retries idempotent per group and creator.';

create unique index if not exists expenses_client_mutation_id_unique_idx
on public.expenses (group_id, created_by, client_mutation_id)
where client_mutation_id is not null;

comment on index public.expenses_client_mutation_id_unique_idx is
  'Prevents duplicate expenses when a mobile client retries the same non-null client mutation id.';

drop function if exists public.create_expense(
  uuid,
  bigint,
  text,
  text,
  uuid,
  text,
  jsonb,
  timestamptz,
  text,
  text
);

create or replace function public.create_expense(
  p_group_id uuid,
  p_amount_paisa bigint,
  p_description text,
  p_category text,
  p_paid_by uuid,
  p_split_method text,
  p_shares jsonb,
  p_occurred_at timestamptz default now(),
  p_note text default null,
  p_receipt_url text default null,
  p_client_mutation_id text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller_id uuid;
  existing_expense_id uuid;
  new_expense_id uuid;
  normalized_client_mutation_id text;
  share_entry record;
  share_user_id uuid;
  share_amount bigint;
  share_count integer := 0;
  split_total bigint := 0;
begin
  caller_id := auth.uid();
  normalized_client_mutation_id := nullif(btrim(p_client_mutation_id), '');

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.current_user_is_group_member(p_group_id) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  if normalized_client_mutation_id is not null then
    select id
    into existing_expense_id
    from public.expenses
    where group_id = p_group_id
      and created_by = caller_id
      and client_mutation_id = normalized_client_mutation_id
    limit 1;

    if existing_expense_id is not null then
      return existing_expense_id;
    end if;
  end if;

  if p_amount_paisa is null or p_amount_paisa <= 0 then
    raise exception 'amount_must_be_positive' using errcode = '23514';
  end if;

  if p_shares is null or jsonb_typeof(p_shares) <> 'object' then
    raise exception 'shares_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id = p_paid_by
      and left_at is null
  ) then
    raise exception 'paid_by_not_group_member' using errcode = '42501';
  end if;

  for share_entry in
    select key, value
    from jsonb_each_text(p_shares)
  loop
    begin
      share_user_id := share_entry.key::uuid;
    exception
      when invalid_text_representation then
        raise exception 'invalid_split_user' using errcode = '22023';
    end;

    begin
      share_amount := share_entry.value::bigint;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'invalid_share_amount' using errcode = '22023';
    end;

    if share_amount < 0 then
      raise exception 'invalid_share_amount' using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.group_members
      where group_id = p_group_id
        and user_id = share_user_id
        and left_at is null
    ) then
      raise exception 'split_user_not_group_member' using errcode = '42501';
    end if;

    share_count := share_count + 1;
    split_total := split_total + share_amount;
  end loop;

  if share_count = 0 then
    raise exception 'shares_required' using errcode = '22023';
  end if;

  if split_total <> p_amount_paisa then
    raise exception 'split_total_mismatch' using errcode = '23514';
  end if;

  begin
    insert into public.expenses (
      group_id,
      amount_paisa,
      description,
      category,
      paid_by,
      split_method,
      occurred_at,
      note,
      receipt_url,
      client_mutation_id,
      created_by
    ) values (
      p_group_id,
      p_amount_paisa,
      p_description,
      p_category,
      p_paid_by,
      p_split_method,
      coalesce(p_occurred_at, now()),
      p_note,
      p_receipt_url,
      normalized_client_mutation_id,
      caller_id
    )
    returning id into new_expense_id;
  exception
    when unique_violation then
      if normalized_client_mutation_id is not null then
        select id
        into existing_expense_id
        from public.expenses
        where group_id = p_group_id
          and created_by = caller_id
          and client_mutation_id = normalized_client_mutation_id
        limit 1;

        if existing_expense_id is not null then
          return existing_expense_id;
        end if;
      end if;

      raise;
  end;

  insert into public.expense_shares (expense_id, user_id, share_paisa)
  select
    new_expense_id,
    key::uuid,
    value::bigint
  from jsonb_each_text(p_shares);

  return new_expense_id;
end;
$$;

comment on function public.create_expense(
  uuid,
  bigint,
  text,
  text,
  uuid,
  text,
  jsonb,
  timestamptz,
  text,
  text,
  text
) is
  'Atomically creates an expense and all expense_shares for the caller. '
  'When p_client_mutation_id is non-null, returns the existing expense id for '
  'the same group, caller, and client mutation id instead of duplicating rows. '
  'Requires auth.uid(), verifies caller, payer, and every split user are '
  'current members of the group, verifies the share total equals amount_paisa, '
  'then inserts expenses and expense_shares in one transaction. The existing '
  'expenses_log_activity trigger writes the expense_added activity_log row in '
  'the same transaction. SECURITY INVOKER keeps normal RLS active; EXECUTE is '
  'granted only to authenticated.';

revoke execute on function public.create_expense(
  uuid,
  bigint,
  text,
  text,
  uuid,
  text,
  jsonb,
  timestamptz,
  text,
  text,
  text
) from public;
revoke execute on function public.create_expense(
  uuid,
  bigint,
  text,
  text,
  uuid,
  text,
  jsonb,
  timestamptz,
  text,
  text,
  text
) from anon;
grant execute on function public.create_expense(
  uuid,
  bigint,
  text,
  text,
  uuid,
  text,
  jsonb,
  timestamptz,
  text,
  text,
  text
) to authenticated;

create or replace function public.create_settlement(
  p_group_id uuid,
  p_from_user uuid,
  p_to_user uuid,
  p_amount_paisa bigint,
  p_method text,
  p_external_ref text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller_id uuid;
  new_settlement_id uuid;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.current_user_is_group_member(p_group_id) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  if p_from_user is null then
    raise exception 'from_user_required' using errcode = '23514';
  end if;

  if p_to_user is null then
    raise exception 'to_user_required' using errcode = '23514';
  end if;

  if p_from_user = p_to_user then
    raise exception 'settlement_parties_must_differ' using errcode = '23514';
  end if;

  if p_amount_paisa is null or p_amount_paisa <= 0 then
    raise exception 'amount_must_be_positive' using errcode = '23514';
  end if;

  if p_method is null or p_method not in ('bkash', 'nagad', 'cash', 'other') then
    raise exception 'invalid_settlement_method' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id = p_from_user
      and left_at is null
  ) then
    raise exception 'from_user_not_group_member' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id = p_to_user
      and left_at is null
  ) then
    raise exception 'to_user_not_group_member' using errcode = '42501';
  end if;

  if p_from_user <> caller_id and p_to_user <> caller_id then
    raise exception 'settlement_party_required' using errcode = '42501';
  end if;

  insert into public.settlements (
    group_id,
    from_user,
    to_user,
    amount_paisa,
    method,
    external_ref,
    occurred_at
  ) values (
    p_group_id,
    p_from_user,
    p_to_user,
    p_amount_paisa,
    p_method,
    p_external_ref,
    coalesce(p_occurred_at, now())
  )
  returning id into new_settlement_id;

  return new_settlement_id;
end;
$$;

comment on function public.create_settlement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text,
  timestamptz
) is
  'Atomically creates a settlement for authenticated group members after '
  'validating both parties, positive amount, supported method, and caller '
  'participation. The existing settlements_log_activity trigger writes the '
  'settled activity_log row in the same transaction. SECURITY INVOKER keeps '
  'normal RLS active; EXECUTE is granted only to authenticated.';

revoke execute on function public.create_settlement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text,
  timestamptz
) from public;
revoke execute on function public.create_settlement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text,
  timestamptz
) from anon;
grant execute on function public.create_settlement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text,
  timestamptz
) to authenticated;
