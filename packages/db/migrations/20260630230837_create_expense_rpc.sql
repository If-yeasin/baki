-- 0005_create_expense_rpc.sql
--
-- Adds an atomic RPC for creating an expense and its share rows together.
-- The mobile app previously inserted `expenses` and `expense_shares`
-- separately, which could leave a parent expense without shares if the second
-- request failed. This function keeps the transaction boundary in Postgres.

set search_path = public;

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
  p_receipt_url text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller_id uuid;
  new_expense_id uuid;
  share_entry record;
  share_user_id uuid;
  share_amount bigint;
  share_count integer := 0;
  split_total bigint := 0;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.current_user_is_group_member(p_group_id) then
    raise exception 'not_group_member' using errcode = '42501';
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
    caller_id
  )
  returning id into new_expense_id;

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
  text
) is
  'Atomically creates an expense and all expense_shares for the caller. '
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
  text
) to authenticated;
