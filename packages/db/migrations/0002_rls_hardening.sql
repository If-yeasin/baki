-- 0002_rls_hardening.sql
--
-- This migration adds no new tables. It documents and tightens the RLS surface
-- shipped in 0001_initial.sql so that:
--
--   1. The absence of an INSERT policy on group_members is recorded as
--      intentional — the only inserter is the SECURITY DEFINER function
--      `accept_invite`. We also revoke EXECUTE on `accept_invite` from the
--      anonymous role so an unauthenticated caller cannot use it.
--   2. The absence of UPDATE / DELETE policies on `settlements` is recorded
--      as intentional — settlements are append-only.
--   3. `groups_update_admins` covers archive (`archived_at`) and rename
--      (`name`) — no additional policy is required.
--   4. `device_tokens_own_rows` covers SELECT/INSERT/UPDATE/DELETE for the
--      device-token table.
--
-- All policy COMMENTs below are no-op metadata; they help future maintainers
-- (and reviewers) understand why a given table has fewer policies than the
-- prose schema in docs/DATA_MODEL.md suggests.
--
-- Append-only: do NOT edit 0001_initial.sql to incorporate any of this.

set search_path = public;

-- 1. group_members default-deny INSERT
--    The only writer is `accept_invite` (SECURITY DEFINER). We keep INSERT
--    closed at the RLS layer.

revoke execute on function public.accept_invite(text) from anon;
grant execute on function public.accept_invite(text) to authenticated;

comment on function public.accept_invite(text) is
  'Adds the calling user to a group by invite_code. SECURITY DEFINER bypasses '
  'RLS for the insert into group_members. EXECUTE is granted only to the '
  'authenticated role; anon cannot call this.';

comment on policy "group_members_select_group_members" on public.group_members is
  'Members of a group can list its membership. INSERT is intentionally '
  'omitted — only accept_invite (SECURITY DEFINER) and the '
  'add_group_creator_member trigger insert rows.';

comment on policy "group_members_update_own_membership" on public.group_members is
  'A user can update only their own membership row (e.g. setting left_at to '
  'leave the group). They cannot change role or another member''s row.';

-- 2. settlements are append-only.
--    No UPDATE / DELETE policy exists, so default-deny applies. We document
--    that here explicitly.

comment on policy "settlements_insert_group_members" on public.settlements is
  'Only a current member of the target group can record a settlement, and '
  'only when they are either the payer (from_user) or the payee (to_user). '
  'UPDATE and DELETE are intentionally without policies — settlements are '
  'append-only; corrections happen via a compensating settlement.';

comment on policy "settlements_select_group_members" on public.settlements is
  'Only current group members may read settlement rows for that group.';

-- 3. groups: rename + archive ride on the same admin-gated UPDATE policy.

comment on policy "groups_update_admins" on public.groups is
  'Admins of a group may update its row (rename, set archived_at, edit '
  'avatar). Non-admins are blocked even if they are members. Hard delete is '
  'not exposed; deletion is soft via deleted_at, set by a future edge '
  'function that verifies no outstanding balances.';

-- 4. device_tokens covers all DML via the FOR ALL policy.

comment on policy "device_tokens_own_rows" on public.device_tokens is
  'A user may SELECT/INSERT/UPDATE/DELETE only their own push-token rows. '
  'Cross-user reads are blocked, which prevents enumeration of installed '
  'devices.';

-- 5. expenses / expense_shares: document the DELETE default-deny.

comment on policy "expenses_update_group_members" on public.expenses is
  'Members of the owning group may UPDATE an expense (including setting '
  'deleted_at for soft delete). Hard DELETE has no policy and is therefore '
  'denied.';

comment on policy "expense_shares_update_group_members" on public.expense_shares is
  'Members of the owning expense''s group may UPDATE a share row to adjust '
  'a split. DELETE has no policy and is denied — shares persist with the '
  'parent expense (which is soft-deleted) for audit.';
