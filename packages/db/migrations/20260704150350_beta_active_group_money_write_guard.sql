-- beta_active_group_money_write_guard.sql
--
-- Keeps money-writing RPCs from accepting new ledger changes after a group is
-- archived or soft-deleted. Direct table writes are already revoked; these RPC
-- checks close the remaining active-group boundary.

set search_path = public;

create or replace function public.current_user_can_write_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.left_at is null
      and g.archived_at is null
      and g.deleted_at is null
  );
$$;

comment on function public.current_user_can_write_group(uuid) is
  'Internal helper for money-writing RPCs. Returns true only when auth.uid() is a current member of a non-archived, non-deleted group.';

revoke execute on function public.current_user_can_write_group(uuid) from public;
revoke execute on function public.current_user_can_write_group(uuid) from anon;
revoke execute on function public.current_user_can_write_group(uuid) from authenticated;

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
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  existing_expense_id uuid;
  new_expense_id uuid;
  normalized_client_mutation_id text;
  share_amount bigint;
  share_count integer := 0;
  share_entry record;
  share_user_id uuid;
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

  if not public.current_user_can_write_group(p_group_id) then
    raise exception 'group_not_active' using errcode = '42501';
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
  'Atomically creates an expense and all expense_shares for an authenticated current member of an active group. '
  'When p_client_mutation_id is non-null, returns the existing expense id for '
  'the same group, caller, and client mutation id instead of duplicating rows. '
  'Requires auth.uid(), verifies caller, payer, and every split user are '
  'current members of the group, verifies the share total equals amount_paisa, '
  'then inserts expenses and expense_shares in one transaction. The existing '
  'expenses_log_activity trigger writes the expense_added activity_log row in '
  'the same transaction. SECURITY DEFINER is used after direct client writes '
  'to money tables were revoked; EXECUTE is granted only to authenticated.';

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
  p_occurred_at timestamptz default now(),
  p_client_mutation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  existing_settlement_id uuid;
  new_settlement_id uuid;
  normalized_client_mutation_id text;
begin
  caller_id := auth.uid();
  normalized_client_mutation_id := nullif(btrim(p_client_mutation_id), '');

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.current_user_is_group_member(p_group_id) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  if not public.current_user_can_write_group(p_group_id) then
    raise exception 'group_not_active' using errcode = '42501';
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

  if normalized_client_mutation_id is not null then
    select id
    into existing_settlement_id
    from public.settlements
    where group_id = p_group_id
      and from_user = p_from_user
      and client_mutation_id = normalized_client_mutation_id
    limit 1;

    if existing_settlement_id is not null then
      return existing_settlement_id;
    end if;
  end if;

  if p_amount_paisa is null or p_amount_paisa <= 0 then
    raise exception 'amount_must_be_positive' using errcode = '23514';
  end if;

  if p_method is null or p_method not in ('bkash', 'nagad', 'cash', 'other') then
    raise exception 'invalid_settlement_method' using errcode = '23514';
  end if;

  begin
    insert into public.settlements (
      group_id,
      from_user,
      to_user,
      amount_paisa,
      method,
      external_ref,
      client_mutation_id,
      occurred_at
    ) values (
      p_group_id,
      p_from_user,
      p_to_user,
      p_amount_paisa,
      p_method,
      p_external_ref,
      normalized_client_mutation_id,
      coalesce(p_occurred_at, now())
    )
    returning id into new_settlement_id;
  exception
    when unique_violation then
      if normalized_client_mutation_id is not null then
        select id
        into existing_settlement_id
        from public.settlements
        where group_id = p_group_id
          and from_user = p_from_user
          and client_mutation_id = normalized_client_mutation_id
        limit 1;

        if existing_settlement_id is not null then
          return existing_settlement_id;
        end if;
      end if;

      raise;
  end;

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
  timestamptz,
  text
) is
  'Atomically creates a settlement for authenticated current members of an active group after '
  'validating both parties, positive amount, supported method, and caller '
  'participation. When p_client_mutation_id is non-null, returns the existing '
  'settlement id for the same group, payer, and client mutation id instead of '
  'duplicating rows. The existing settlements_log_activity trigger writes the '
  'settled activity_log row in the same transaction. SECURITY DEFINER is used '
  'after direct client writes to money tables were revoked; EXECUTE is granted '
  'only to authenticated.';

revoke execute on function public.create_settlement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text,
  timestamptz,
  text
) from public;
revoke execute on function public.create_settlement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text,
  timestamptz,
  text
) from anon;
grant execute on function public.create_settlement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text,
  timestamptz,
  text
) to authenticated;

create or replace function public.edit_expense(
  p_expense_id uuid,
  p_amount_paisa bigint,
  p_description text,
  p_category text,
  p_paid_by uuid,
  p_split_method text,
  p_shares jsonb,
  p_occurred_at timestamptz default null,
  p_note text default null,
  p_receipt_url text default null,
  p_client_mutation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  normalized_client_mutation_id text;
  normalized_description text;
  receipt_expense_id uuid;
  share_amount bigint;
  share_count integer := 0;
  share_entry record;
  share_user_id uuid;
  split_total bigint := 0;
  target_expense record;
begin
  caller_id := auth.uid();
  normalized_client_mutation_id := nullif(btrim(p_client_mutation_id), '');
  normalized_description := btrim(coalesce(p_description, ''));

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if normalized_client_mutation_id is not null then
    select expense_id
    into receipt_expense_id
    from public.expense_mutation_receipts
    where operation = 'edit'
      and actor_id = caller_id
      and client_mutation_id = normalized_client_mutation_id
    limit 1;

    if receipt_expense_id is not null then
      return receipt_expense_id;
    end if;
  end if;

  select *
  into target_expense
  from public.expenses
  where id = p_expense_id
  for update;

  if not found or target_expense.deleted_at is not null then
    raise exception 'expense_not_found' using errcode = '22023';
  end if;

  if not public.current_user_is_group_member(target_expense.group_id) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  if not public.current_user_can_write_group(target_expense.group_id) then
    raise exception 'group_not_active' using errcode = '42501';
  end if;

  if p_amount_paisa is null or p_amount_paisa <= 0 then
    raise exception 'amount_must_be_positive' using errcode = '23514';
  end if;

  if char_length(normalized_description) < 1 or char_length(normalized_description) > 200 then
    raise exception 'invalid_expense_description' using errcode = '23514';
  end if;

  if p_category is null or p_category not in (
    'food',
    'rent',
    'utility',
    'transport',
    'entertainment',
    'shopping',
    'medical',
    'education',
    'gift',
    'other'
  ) then
    raise exception 'invalid_expense_category' using errcode = '23514';
  end if;

  if p_split_method is null or p_split_method not in ('equal', 'exact', 'percent', 'shares') then
    raise exception 'invalid_split_method' using errcode = '23514';
  end if;

  if p_shares is null or jsonb_typeof(p_shares) <> 'object' then
    raise exception 'shares_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.group_members
    where group_id = target_expense.group_id
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
      where group_id = target_expense.group_id
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

  if normalized_client_mutation_id is not null then
    begin
      insert into public.expense_mutation_receipts (
        operation,
        expense_id,
        group_id,
        actor_id,
        client_mutation_id
      ) values (
        'edit',
        p_expense_id,
        target_expense.group_id,
        caller_id,
        normalized_client_mutation_id
      );
    exception
      when unique_violation then
        select expense_id
        into receipt_expense_id
        from public.expense_mutation_receipts
        where operation = 'edit'
          and actor_id = caller_id
          and client_mutation_id = normalized_client_mutation_id
        limit 1;

        if receipt_expense_id is not null then
          return receipt_expense_id;
        end if;

        raise;
    end;
  end if;

  perform set_config('request.baki.activity_actor_id', caller_id::text, true);

  update public.expenses
  set amount_paisa = p_amount_paisa,
      description = normalized_description,
      category = p_category,
      paid_by = p_paid_by,
      split_method = p_split_method,
      occurred_at = coalesce(p_occurred_at, target_expense.occurred_at),
      note = p_note,
      receipt_url = p_receipt_url
  where id = p_expense_id;

  perform set_config('request.baki.activity_actor_id', '', true);

  delete from public.expense_shares
  where expense_id = p_expense_id;

  insert into public.expense_shares (expense_id, user_id, share_paisa)
  select
    p_expense_id,
    key::uuid,
    value::bigint
  from jsonb_each_text(p_shares);

  return p_expense_id;
end;
$$;

comment on function public.edit_expense(
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
  'Atomically edits an expense and replaces its shares for an authenticated current member of an active group. '
  'When p_client_mutation_id is non-null, returns the previous edited expense '
  'id for the same actor and mutation id. Requires auth.uid(), validates '
  'caller, payer, and split users are current members, validates the share '
  'total equals amount_paisa, and lets the expenses_log_activity trigger write '
  'expense_edited with the actual editor as actor.';

revoke execute on function public.edit_expense(
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
revoke execute on function public.edit_expense(
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
grant execute on function public.edit_expense(
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

create or replace function public.delete_expense(
  p_expense_id uuid,
  p_client_mutation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  normalized_client_mutation_id text;
  receipt_expense_id uuid;
  target_expense record;
begin
  caller_id := auth.uid();
  normalized_client_mutation_id := nullif(btrim(p_client_mutation_id), '');

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if normalized_client_mutation_id is not null then
    select expense_id
    into receipt_expense_id
    from public.expense_mutation_receipts
    where operation = 'delete'
      and actor_id = caller_id
      and client_mutation_id = normalized_client_mutation_id
    limit 1;

    if receipt_expense_id is not null then
      return receipt_expense_id;
    end if;
  end if;

  select *
  into target_expense
  from public.expenses
  where id = p_expense_id
  for update;

  if not found then
    raise exception 'expense_not_found' using errcode = '22023';
  end if;

  if not public.current_user_is_group_member(target_expense.group_id) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  if not public.current_user_can_write_group(target_expense.group_id) then
    raise exception 'group_not_active' using errcode = '42501';
  end if;

  if normalized_client_mutation_id is not null then
    begin
      insert into public.expense_mutation_receipts (
        operation,
        expense_id,
        group_id,
        actor_id,
        client_mutation_id
      ) values (
        'delete',
        p_expense_id,
        target_expense.group_id,
        caller_id,
        normalized_client_mutation_id
      );
    exception
      when unique_violation then
        select expense_id
        into receipt_expense_id
        from public.expense_mutation_receipts
        where operation = 'delete'
          and actor_id = caller_id
          and client_mutation_id = normalized_client_mutation_id
        limit 1;

        if receipt_expense_id is not null then
          return receipt_expense_id;
        end if;

        raise;
    end;
  end if;

  if target_expense.deleted_at is null then
    perform set_config('request.baki.activity_actor_id', caller_id::text, true);

    update public.expenses
    set deleted_at = now()
    where id = p_expense_id
      and deleted_at is null;

    perform set_config('request.baki.activity_actor_id', '', true);
  end if;

  return p_expense_id;
end;
$$;

comment on function public.delete_expense(uuid, text) is
  'Soft-deletes an expense for an authenticated current member of an active group. When '
  'p_client_mutation_id is non-null, returns the previous deleted expense id '
  'for the same actor and mutation id. The expenses_log_activity trigger writes '
  'expense_deleted with the actual deleting member as actor.';

revoke execute on function public.delete_expense(uuid, text) from public;
revoke execute on function public.delete_expense(uuid, text) from anon;
grant execute on function public.delete_expense(uuid, text) to authenticated;
