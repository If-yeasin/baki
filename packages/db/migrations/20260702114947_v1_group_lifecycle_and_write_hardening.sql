-- 0008_v1_group_lifecycle_and_write_hardening.sql
--
-- Moves group lifecycle writes behind validating RPCs and tightens direct
-- table-write surfaces before the v1 release-candidate work expands features.

set search_path = public;

alter table public.groups
add column if not exists client_mutation_id text;

comment on column public.groups.client_mutation_id is
  'Optional client-generated mutation id used to make create_group retries idempotent per creator.';

create unique index if not exists groups_client_mutation_id_unique_idx
on public.groups (created_by, client_mutation_id)
where client_mutation_id is not null;

comment on index public.groups_client_mutation_id_unique_idx is
  'Prevents duplicate groups when a mobile client retries the same non-null client mutation id.';

alter table public.activity_log
drop constraint if exists activity_log_event_type_check;

alter table public.activity_log
add constraint activity_log_event_type_check
check (event_type in (
  'expense_added',
  'expense_edited',
  'expense_deleted',
  'settled',
  'member_joined',
  'member_left',
  'group_created',
  'group_renamed',
  'group_template_changed',
  'group_archived',
  'group_deleted',
  'invite_regenerated'
));

create or replace function public.group_has_outstanding_balances(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from (
      select user_id, sum(delta_paisa)::bigint as net_paisa
      from (
        select e.paid_by as user_id, e.amount_paisa as delta_paisa
        from public.expenses e
        where e.group_id = p_group_id
          and e.deleted_at is null

        union all

        select es.user_id, -es.share_paisa as delta_paisa
        from public.expense_shares es
        join public.expenses e on e.id = es.expense_id
        where e.group_id = p_group_id
          and e.deleted_at is null

        union all

        select s.from_user, s.amount_paisa as delta_paisa
        from public.settlements s
        where s.group_id = p_group_id

        union all

        select s.to_user, -s.amount_paisa as delta_paisa
        from public.settlements s
        where s.group_id = p_group_id
      ) deltas
      group by user_id
      having sum(delta_paisa) <> 0
    ) outstanding
  );
$$;

create or replace function public.user_has_group_balance(
  p_group_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select sum(delta_paisa)::bigint <> 0
    from (
      select e.amount_paisa as delta_paisa
      from public.expenses e
      where e.group_id = p_group_id
        and e.paid_by = p_user_id
        and e.deleted_at is null

      union all

      select -es.share_paisa as delta_paisa
      from public.expense_shares es
      join public.expenses e on e.id = es.expense_id
      where e.group_id = p_group_id
        and e.deleted_at is null
        and es.user_id = p_user_id

      union all

      select s.amount_paisa as delta_paisa
      from public.settlements s
      where s.group_id = p_group_id
        and s.from_user = p_user_id

      union all

      select -s.amount_paisa as delta_paisa
      from public.settlements s
      where s.group_id = p_group_id
        and s.to_user = p_user_id
    ) deltas
  ), false);
$$;

create or replace function public.create_group(
  p_name text,
  p_template text,
  p_client_mutation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  existing_group_id uuid;
  new_group_id uuid;
  normalized_client_mutation_id text;
  normalized_name text;
begin
  caller_id := auth.uid();
  normalized_client_mutation_id := nullif(btrim(p_client_mutation_id), '');
  normalized_name := btrim(coalesce(p_name, ''));

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if char_length(normalized_name) < 1 or char_length(normalized_name) > 50 then
    raise exception 'invalid_group_name' using errcode = '23514';
  end if;

  if p_template is null or p_template not in ('mess', 'family', 'trip', 'event', 'custom') then
    raise exception 'invalid_group_template' using errcode = '23514';
  end if;

  if normalized_client_mutation_id is not null then
    select id
    into existing_group_id
    from public.groups
    where created_by = caller_id
      and client_mutation_id = normalized_client_mutation_id
    limit 1;

    if existing_group_id is not null then
      return existing_group_id;
    end if;
  end if;

  begin
    insert into public.groups (
      name,
      template,
      created_by,
      client_mutation_id
    ) values (
      normalized_name,
      p_template,
      caller_id,
      normalized_client_mutation_id
    )
    returning id into new_group_id;
  exception
    when unique_violation then
      if normalized_client_mutation_id is not null then
        select id
        into existing_group_id
        from public.groups
        where created_by = caller_id
          and client_mutation_id = normalized_client_mutation_id
        limit 1;

        if existing_group_id is not null then
          return existing_group_id;
        end if;
      end if;

      raise;
  end;

  insert into public.activity_log (group_id, actor_id, event_type, payload)
  values (
    new_group_id,
    caller_id,
    'group_created',
    jsonb_build_object('name', normalized_name, 'template', p_template)
  );

  return new_group_id;
end;
$$;

create or replace function public.rename_group(
  p_group_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  old_name text;
  normalized_name text;
begin
  caller_id := auth.uid();
  normalized_name := btrim(coalesce(p_name, ''));

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.current_user_is_group_admin(p_group_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 1 or char_length(normalized_name) > 50 then
    raise exception 'invalid_group_name' using errcode = '23514';
  end if;

  select name
  into old_name
  from public.groups
  where id = p_group_id
    and deleted_at is null;

  if old_name is null then
    raise exception 'group_not_found' using errcode = '22023';
  end if;

  update public.groups
  set name = normalized_name
  where id = p_group_id;

  insert into public.activity_log (group_id, actor_id, event_type, payload)
  values (
    p_group_id,
    caller_id,
    'group_renamed',
    jsonb_build_object('old_name', old_name, 'new_name', normalized_name)
  );
end;
$$;

create or replace function public.update_group_template(
  p_group_id uuid,
  p_template text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  old_template text;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.current_user_is_group_admin(p_group_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_template is null or p_template not in ('mess', 'family', 'trip', 'event', 'custom') then
    raise exception 'invalid_group_template' using errcode = '23514';
  end if;

  select template
  into old_template
  from public.groups
  where id = p_group_id
    and deleted_at is null;

  if old_template is null then
    raise exception 'group_not_found' using errcode = '22023';
  end if;

  update public.groups
  set template = p_template
  where id = p_group_id;

  insert into public.activity_log (group_id, actor_id, event_type, payload)
  values (
    p_group_id,
    caller_id,
    'group_template_changed',
    jsonb_build_object('old_template', old_template, 'new_template', p_template)
  );
end;
$$;

create or replace function public.archive_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.current_user_is_group_admin(p_group_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  update public.groups
  set archived_at = coalesce(archived_at, now())
  where id = p_group_id
    and deleted_at is null;

  if not found then
    raise exception 'group_not_found' using errcode = '22023';
  end if;

  insert into public.activity_log (group_id, actor_id, event_type, payload)
  values (p_group_id, caller_id, 'group_archived', '{}'::jsonb);
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  active_admin_count integer;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.current_user_is_group_member(p_group_id) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  if public.user_has_group_balance(p_group_id, caller_id) then
    raise exception 'outstanding_balance' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into active_admin_count
  from public.group_members
  where group_id = p_group_id
    and role = 'admin'
    and left_at is null;

  if exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id = caller_id
      and role = 'admin'
      and left_at is null
  ) and active_admin_count <= 1 then
    raise exception 'last_admin_cannot_leave' using errcode = 'P0001';
  end if;

  update public.group_members
  set left_at = now()
  where group_id = p_group_id
    and user_id = caller_id
    and left_at is null;

  if not found then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  insert into public.activity_log (group_id, actor_id, event_type, payload)
  values (p_group_id, caller_id, 'member_left', '{}'::jsonb);
end;
$$;

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  group_creator uuid;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select created_by
  into group_creator
  from public.groups
  where id = p_group_id
    and deleted_at is null;

  if group_creator is null then
    raise exception 'group_not_found' using errcode = '22023';
  end if;

  if group_creator <> caller_id then
    raise exception 'creator_required' using errcode = '42501';
  end if;

  if public.group_has_outstanding_balances(p_group_id) then
    raise exception 'outstanding_balances' using errcode = 'P0001';
  end if;

  update public.groups
  set deleted_at = coalesce(deleted_at, now())
  where id = p_group_id;

  insert into public.activity_log (group_id, actor_id, event_type, payload)
  values (p_group_id, caller_id, 'group_deleted', '{}'::jsonb);
end;
$$;

create or replace function public.regenerate_group_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  next_code text;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.current_user_is_group_admin(p_group_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  loop
    next_code := lower(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (
      select 1
      from public.groups
      where invite_code = next_code
    );
  end loop;

  update public.groups
  set invite_code = next_code
  where id = p_group_id
    and deleted_at is null;

  if not found then
    raise exception 'group_not_found' using errcode = '22023';
  end if;

  insert into public.activity_log (group_id, actor_id, event_type, payload)
  values (p_group_id, caller_id, 'invite_regenerated', '{}'::jsonb);

  return next_code;
end;
$$;

drop policy if exists "groups_insert_authenticated_creator" on public.groups;
drop policy if exists "groups_update_admins" on public.groups;
drop policy if exists "group_members_update_own_membership" on public.group_members;
drop policy if exists "expenses_insert_group_members" on public.expenses;
drop policy if exists "expenses_update_group_members" on public.expenses;
drop policy if exists "expense_shares_insert_group_members" on public.expense_shares;
drop policy if exists "expense_shares_update_group_members" on public.expense_shares;
drop policy if exists "settlements_insert_group_members" on public.settlements;
drop policy if exists "activity_log_insert_group_members" on public.activity_log;

alter function public.create_expense(
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
) security definer;

alter function public.create_settlement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text,
  timestamptz,
  text
) security definer;

revoke execute on function public.create_group(text, text, text) from public;
revoke execute on function public.create_group(text, text, text) from anon;
grant execute on function public.create_group(text, text, text) to authenticated;

revoke execute on function public.rename_group(uuid, text) from public;
revoke execute on function public.rename_group(uuid, text) from anon;
grant execute on function public.rename_group(uuid, text) to authenticated;

revoke execute on function public.update_group_template(uuid, text) from public;
revoke execute on function public.update_group_template(uuid, text) from anon;
grant execute on function public.update_group_template(uuid, text) to authenticated;

revoke execute on function public.archive_group(uuid) from public;
revoke execute on function public.archive_group(uuid) from anon;
grant execute on function public.archive_group(uuid) to authenticated;

revoke execute on function public.leave_group(uuid) from public;
revoke execute on function public.leave_group(uuid) from anon;
grant execute on function public.leave_group(uuid) to authenticated;

revoke execute on function public.delete_group(uuid) from public;
revoke execute on function public.delete_group(uuid) from anon;
grant execute on function public.delete_group(uuid) to authenticated;

revoke execute on function public.regenerate_group_invite(uuid) from public;
revoke execute on function public.regenerate_group_invite(uuid) from anon;
grant execute on function public.regenerate_group_invite(uuid) to authenticated;

revoke execute on function public.group_has_outstanding_balances(uuid) from public;
revoke execute on function public.group_has_outstanding_balances(uuid) from anon;
revoke execute on function public.group_has_outstanding_balances(uuid) from authenticated;

revoke execute on function public.user_has_group_balance(uuid, uuid) from public;
revoke execute on function public.user_has_group_balance(uuid, uuid) from anon;
revoke execute on function public.user_has_group_balance(uuid, uuid) from authenticated;

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
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

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

  update public.groups
  set created_by = tombstone_id,
      client_mutation_id = null
  where created_by = caller_id;

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

  delete from auth.users where id = caller_id;
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the calling user account after refusing unsettled active balances. '
  'Reassigns groups.created_by and ledger FK columns to the tombstone profile, '
  'then deletes auth.users so profiles, group_members, and device_tokens cascade.';

revoke execute on function public.delete_my_account() from public;
revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
