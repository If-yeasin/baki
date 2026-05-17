begin;

set constraints all deferred;

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
  updated_at
) values
  (
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'tanvir@example.test',
    '+8801700000001',
    crypt('password', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'rini@example.test',
    '+8801800000002',
    crypt('password', gen_salt('bf')),
    now(),
    now(),
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, display_name, phone, locale, bkash_number, nagad_number)
values
  ('11111111-1111-4111-8111-111111111111', 'Tanvir', '+8801700000001', 'bn', '+8801700000001', null),
  ('22222222-2222-4222-8222-222222222222', 'Rini', '+8801800000002', 'bn', null, '+8801800000002')
on conflict (id) do nothing;

insert into public.groups (id, name, template, invite_code, created_by)
values (
  '33333333-3333-4333-8333-333333333333',
  'Sajek Trip',
  'trip',
  'sajek1',
  '11111111-1111-4111-8111-111111111111'
)
on conflict (id) do nothing;

insert into public.group_members (group_id, user_id, role)
values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'member')
on conflict (group_id, user_id) do nothing;

insert into public.expenses (id, group_id, amount_paisa, description, category, paid_by, split_method, created_by)
values
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333333', 120000, 'Jeep fare', 'transport', '11111111-1111-4111-8111-111111111111', 'equal', '11111111-1111-4111-8111-111111111111'),
  ('44444444-4444-4444-8444-444444444442', '33333333-3333-4333-8333-333333333333', 80000, 'Dinner', 'food', '22222222-2222-4222-8222-222222222222', 'equal', '22222222-2222-4222-8222-222222222222'),
  ('44444444-4444-4444-8444-444444444443', '33333333-3333-4333-8333-333333333333', 50000, 'Snacks', 'food', '11111111-1111-4111-8111-111111111111', 'equal', '11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

insert into public.expense_shares (expense_id, user_id, share_paisa)
values
  ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', 60000),
  ('44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222222', 60000),
  ('44444444-4444-4444-8444-444444444442', '11111111-1111-4111-8111-111111111111', 40000),
  ('44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222', 40000),
  ('44444444-4444-4444-8444-444444444443', '11111111-1111-4111-8111-111111111111', 25000),
  ('44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222222', 25000)
on conflict (expense_id, user_id) do nothing;

insert into public.settlements (id, group_id, from_user, to_user, amount_paisa, method, external_ref)
values (
  '55555555-5555-4555-8555-555555555555',
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  25000,
  'bkash',
  'seed-bkash-001'
)
on conflict (id) do nothing;

commit;
