-- 0007_settlement_idempotency_and_queue_replay.sql
--
-- Gives settlement creation the same retry safety as expense creation.
-- Mobile clients persist one client mutation id per settlement attempt; replay
-- returns the original settlement id instead of appending duplicate ledger rows.

set search_path = public;

alter table public.settlements
add column if not exists client_mutation_id text;

comment on column public.settlements.client_mutation_id is
  'Optional client-generated mutation id used to make create_settlement retries idempotent per group and payer.';

create unique index if not exists settlements_client_mutation_id_unique_idx
on public.settlements (group_id, from_user, client_mutation_id)
where client_mutation_id is not null;

comment on index public.settlements_client_mutation_id_unique_idx is
  'Prevents duplicate settlements when a mobile client retries the same non-null client mutation id.';

drop function if exists public.create_settlement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text,
  timestamptz
);

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
security invoker
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
  'Atomically creates a settlement for authenticated group members after '
  'validating both parties, positive amount, supported method, and caller '
  'participation. When p_client_mutation_id is non-null, returns the existing '
  'settlement id for the same group, payer, and client mutation id instead of '
  'duplicating rows. The existing settlements_log_activity trigger writes the '
  'settled activity_log row in the same transaction. SECURITY INVOKER keeps '
  'normal RLS active; EXECUTE is granted only to authenticated.';

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
