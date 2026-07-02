-- 0010_v1_notification_preferences.sql
--
-- Adds own-row notification preferences for Expo push registration.

set search_path = public;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  expense_activity boolean not null default true,
  settlement_activity boolean not null default true,
  reminders boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Per-user push preference switches. Own row only; cascades with profile deletion.';

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own"
on public.notification_preferences;
create policy "notification_preferences_select_own"
on public.notification_preferences for select
using (user_id = auth.uid());

drop policy if exists "notification_preferences_insert_own"
on public.notification_preferences;
create policy "notification_preferences_insert_own"
on public.notification_preferences for insert
with check (user_id = auth.uid());

drop policy if exists "notification_preferences_update_own"
on public.notification_preferences;
create policy "notification_preferences_update_own"
on public.notification_preferences for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on public.notification_preferences to authenticated;
revoke delete on public.notification_preferences from authenticated;
revoke all on public.notification_preferences from anon;
