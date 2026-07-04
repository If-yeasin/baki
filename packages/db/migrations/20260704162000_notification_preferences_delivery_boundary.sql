-- notification_preferences_delivery_boundary.sql
--
-- Fresh preference rows should not imply push delivery is enabled before the
-- user grants OS permission and a device token is saved.

set search_path = public;

alter table public.notification_preferences
alter column push_enabled set default false;

comment on column public.notification_preferences.push_enabled is
  'User-controlled master switch for server-side push delivery. Defaults false until a device token is registered.';
