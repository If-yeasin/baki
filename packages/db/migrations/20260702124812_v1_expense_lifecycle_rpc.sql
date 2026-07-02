-- 0009_v1_expense_lifecycle_rpc.sql
--
-- Adds replay-safe expense edit/delete RPCs now that direct ledger table
-- writes are revoked for mobile clients.

set search_path = public;

create table if not exists public.expense_mutation_receipts (
  id uuid primary key default gen_random_uuid(),
  operation text not null check (operation in ('edit', 'delete')),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  client_mutation_id text not null,
  created_at timestamptz not null default now(),
  unique (operation, actor_id, client_mutation_id)
);

comment on table public.expense_mutation_receipts is
  'Internal idempotency receipts for offline/retry-safe expense edits and deletes.';
comment on column public.expense_mutation_receipts.client_mutation_id is
  'Client-generated id scoped by operation and actor_id so replayed edit/delete RPCs do not duplicate activity.';

create index if not exists expense_mutation_receipts_group_created_idx
on public.expense_mutation_receipts (group_id, created_at desc);

alter table public.expense_mutation_receipts enable row level security;
revoke all on table public.expense_mutation_receipts from public;
revoke all on table public.expense_mutation_receipts from anon;
revoke all on table public.expense_mutation_receipts from authenticated;

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  actor_setting text;
  details jsonb;
  event text;
  source_group_id uuid;
begin
  if tg_table_name = 'expenses' then
    source_group_id = coalesce(new.group_id, old.group_id);
    actor_setting := nullif(current_setting('request.baki.activity_actor_id', true), '');
    actor = coalesce(actor_setting::uuid, coalesce(new.created_by, old.created_by));
    event = case
      when tg_op = 'INSERT' then 'expense_added'
      when tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then 'expense_deleted'
      else 'expense_edited'
    end;
    details = jsonb_build_object(
      'expense_id', coalesce(new.id, old.id),
      'amount_paisa', coalesce(new.amount_paisa, old.amount_paisa),
      'description', coalesce(new.description, old.description)
    );
  elsif tg_table_name = 'settlements' then
    source_group_id = new.group_id;
    actor = new.from_user;
    event = 'settled';
    details = jsonb_build_object(
      'settlement_id', new.id,
      'from_user', new.from_user,
      'to_user', new.to_user,
      'amount_paisa', new.amount_paisa,
      'method', new.method
    );
  else
    return null;
  end if;

  insert into public.activity_log (group_id, actor_id, event_type, payload)
  values (source_group_id, actor, event, details);

  return coalesce(new, old);
end;
$$;

drop function if exists public.edit_expense(
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
);

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
  'Atomically edits an expense and replaces its shares for the caller. '
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

drop function if exists public.delete_expense(uuid, text);

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
  'Soft-deletes an expense for a current group member. When '
  'p_client_mutation_id is non-null, returns the previous deleted expense id '
  'for the same actor and mutation id. The expenses_log_activity trigger writes '
  'expense_deleted with the actual deleting member as actor.';

revoke execute on function public.delete_expense(uuid, text) from public;
revoke execute on function public.delete_expense(uuid, text) from anon;
grant execute on function public.delete_expense(uuid, text) to authenticated;
