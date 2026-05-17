create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  phone text not null,
  avatar_url text,
  default_currency text not null default 'BDT',
  locale text not null default 'bn' check (locale in ('bn', 'en')),
  bkash_number text,
  nagad_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id)
);

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

create table public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  share_paisa bigint not null check (share_paisa >= 0),
  primary key (expense_id, user_id)
);

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

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_token text not null,
  platform text not null check (platform in ('ios','android')),
  last_seen_at timestamptz not null default now(),
  unique (user_id, expo_token)
);

create index groups_invite_code_idx on public.groups (invite_code);
create index expenses_group_occurred_idx on public.expenses (group_id, occurred_at desc);
create index expense_shares_user_idx on public.expense_shares (user_id);
create index settlements_group_occurred_idx on public.settlements (group_id, occurred_at desc);
create index activity_log_group_created_idx on public.activity_log (group_id, created_at desc);
create index group_members_active_user_idx on public.group_members (user_id) where left_at is null;
create index device_tokens_user_idx on public.device_tokens (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create or replace function public.current_user_is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and left_at is null
  );
$$;

create or replace function public.current_user_is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and role = 'admin'
      and left_at is null
  );
$$;

create or replace function public.enforce_share_sum()
returns trigger
language plpgsql
as $$
declare
  target_expense_id uuid;
  expected_amount bigint;
  actual_amount bigint;
begin
  target_expense_id = coalesce(new.expense_id, old.expense_id);

  select amount_paisa
  into expected_amount
  from public.expenses
  where id = target_expense_id
    and deleted_at is null;

  if expected_amount is null then
    return null;
  end if;

  select coalesce(sum(share_paisa), 0)
  into actual_amount
  from public.expense_shares
  where expense_id = target_expense_id;

  if actual_amount <> expected_amount then
    raise exception 'expense shares must sum to amount_paisa for expense %', target_expense_id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger expense_shares_enforce_sum
after insert or update or delete on public.expense_shares
deferrable initially deferred
for each row execute function public.enforce_share_sum();

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event text;
  source_group_id uuid;
  actor uuid;
  details jsonb;
begin
  if tg_table_name = 'expenses' then
    source_group_id = coalesce(new.group_id, old.group_id);
    actor = coalesce(new.created_by, old.created_by);
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

create trigger expenses_log_activity
after insert or update on public.expenses
for each row execute function public.log_activity();

create trigger settlements_log_activity
after insert on public.settlements
for each row execute function public.log_activity();

create or replace function public.add_group_creator_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict (group_id, user_id)
  do update set role = 'admin', left_at = null;

  return new;
end;
$$;

create trigger groups_add_creator_member
after insert on public.groups
for each row execute function public.add_group_creator_member();

create or replace function public.accept_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
  actor uuid;
begin
  actor = auth.uid();

  if actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select id
  into target_group_id
  from public.groups
  where invite_code = lower(p_invite_code)
    and archived_at is null
    and deleted_at is null;

  if target_group_id is null then
    raise exception 'invite_not_found' using errcode = '22023';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group_id, actor, 'member')
  on conflict (group_id, user_id)
  do update set left_at = null;

  insert into public.activity_log (group_id, actor_id, event_type)
  values (target_group_id, actor, 'member_joined');

  return target_group_id;
end;
$$;

create or replace function public.simplify_debts(p_group_id uuid)
returns table(from_user uuid, to_user uuid, amount_paisa bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  debtor record;
  creditor record;
  transfer_amount bigint;
begin
  if not public.current_user_is_group_member(p_group_id) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  create temporary table if not exists baki_net_balances (
    user_id uuid primary key,
    net_paisa bigint not null
  ) on commit drop;

  truncate table baki_net_balances;

  insert into baki_net_balances (user_id, net_paisa)
  select user_id, sum(delta_paisa)::bigint
  from (
    select e.paid_by as user_id, e.amount_paisa as delta_paisa
    from public.expenses e
    where e.group_id = p_group_id and e.deleted_at is null

    union all

    select es.user_id, -es.share_paisa as delta_paisa
    from public.expense_shares es
    join public.expenses e on e.id = es.expense_id
    where e.group_id = p_group_id and e.deleted_at is null

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
  having sum(delta_paisa) <> 0;

  create temporary table if not exists baki_debtors (
    user_id uuid primary key,
    amount_paisa bigint not null
  ) on commit drop;

  create temporary table if not exists baki_creditors (
    user_id uuid primary key,
    amount_paisa bigint not null
  ) on commit drop;

  truncate table baki_debtors;
  truncate table baki_creditors;

  insert into baki_debtors
  select user_id, abs(net_paisa) from baki_net_balances where net_paisa < 0;

  insert into baki_creditors
  select user_id, net_paisa from baki_net_balances where net_paisa > 0;

  loop
    select * into debtor from baki_debtors order by amount_paisa desc limit 1;
    select * into creditor from baki_creditors order by amount_paisa desc limit 1;

    exit when debtor.user_id is null or creditor.user_id is null;

    transfer_amount = least(debtor.amount_paisa, creditor.amount_paisa);
    from_user = debtor.user_id;
    to_user = creditor.user_id;
    amount_paisa = transfer_amount;
    return next;

    update baki_debtors
    set amount_paisa = amount_paisa - transfer_amount
    where user_id = debtor.user_id;

    update baki_creditors
    set amount_paisa = amount_paisa - transfer_amount
    where user_id = creditor.user_id;

    delete from baki_debtors where amount_paisa = 0;
    delete from baki_creditors where amount_paisa = 0;
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;
alter table public.activity_log enable row level security;
alter table public.device_tokens enable row level security;

create policy "profiles_select_self_or_shared_group"
on public.profiles for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.group_members self_member
    join public.group_members other_member
      on other_member.group_id = self_member.group_id
    where self_member.user_id = auth.uid()
      and self_member.left_at is null
      and other_member.user_id = profiles.id
      and other_member.left_at is null
  )
);

create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "groups_select_members"
on public.groups for select
using (public.current_user_is_group_member(id));

create policy "groups_insert_authenticated_creator"
on public.groups for insert
with check (auth.uid() is not null and created_by = auth.uid());

create policy "groups_update_admins"
on public.groups for update
using (public.current_user_is_group_admin(id))
with check (public.current_user_is_group_admin(id));

create policy "group_members_select_group_members"
on public.group_members for select
using (public.current_user_is_group_member(group_id));

create policy "group_members_update_own_membership"
on public.group_members for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "expenses_select_group_members"
on public.expenses for select
using (public.current_user_is_group_member(group_id));

create policy "expenses_insert_group_members"
on public.expenses for insert
with check (public.current_user_is_group_member(group_id) and created_by = auth.uid());

create policy "expenses_update_group_members"
on public.expenses for update
using (public.current_user_is_group_member(group_id))
with check (public.current_user_is_group_member(group_id) and created_by = auth.uid());

create policy "expense_shares_select_group_members"
on public.expense_shares for select
using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id
      and public.current_user_is_group_member(e.group_id)
  )
);

create policy "expense_shares_insert_group_members"
on public.expense_shares for insert
with check (
  exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id
      and public.current_user_is_group_member(e.group_id)
  )
);

create policy "expense_shares_update_group_members"
on public.expense_shares for update
using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id
      and public.current_user_is_group_member(e.group_id)
  )
)
with check (
  exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id
      and public.current_user_is_group_member(e.group_id)
  )
);

create policy "settlements_select_group_members"
on public.settlements for select
using (public.current_user_is_group_member(group_id));

create policy "settlements_insert_group_members"
on public.settlements for insert
with check (
  public.current_user_is_group_member(group_id)
  and (from_user = auth.uid() or to_user = auth.uid())
);

create policy "activity_log_select_group_members"
on public.activity_log for select
using (public.current_user_is_group_member(group_id));

create policy "activity_log_insert_group_members"
on public.activity_log for insert
with check (public.current_user_is_group_member(group_id) and actor_id = auth.uid());

create policy "device_tokens_own_rows"
on public.device_tokens for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.expenses;
  alter publication supabase_realtime add table public.expense_shares;
  alter publication supabase_realtime add table public.settlements;
  alter publication supabase_realtime add table public.activity_log;
  alter publication supabase_realtime add table public.group_members;
exception
  when duplicate_object or undefined_object then null;
end;
$$;
