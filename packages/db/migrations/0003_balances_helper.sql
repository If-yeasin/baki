-- 0003_balances_helper.sql
--
-- Adds `get_group_balances(p_group_id uuid)` so the mobile app can render
-- per-member net balances without recomputing the math client-side. The
-- function returns one row per member with a non-zero net balance:
--
--   net_paisa > 0  -> the user is owed that much by the rest of the group
--   net_paisa < 0  -> the user owes that much to the rest of the group
--
-- It is SECURITY DEFINER so the function can read expenses, expense_shares
-- and settlements regardless of the caller's RLS policies; it guards
-- access by checking `current_user_is_group_member(p_group_id)` first.
--
-- The shape mirrors `simplify_debts`'s data dependencies (expenses,
-- expense_shares, settlements) but does NOT collapse to transfers — clients
-- that want the minimum-transaction plan keep calling `simplify_debts`.

set search_path = public;

create or replace function public.get_group_balances(p_group_id uuid)
returns table (user_id uuid, net_paisa bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_group_member(p_group_id) then
    raise exception 'not_group_member' using errcode = '42501';
  end if;

  return query
  select deltas.user_id, sum(deltas.delta_paisa)::bigint as net_paisa
  from (
    -- payer is credited the full amount of each expense
    select e.paid_by as user_id, e.amount_paisa as delta_paisa
    from public.expenses e
    where e.group_id = p_group_id
      and e.deleted_at is null

    union all

    -- each share consumer is debited their share
    select es.user_id, -es.share_paisa as delta_paisa
    from public.expense_shares es
    join public.expenses e on e.id = es.expense_id
    where e.group_id = p_group_id
      and e.deleted_at is null

    union all

    -- a settlement reduces the payer's debt
    select s.from_user as user_id, s.amount_paisa as delta_paisa
    from public.settlements s
    where s.group_id = p_group_id

    union all

    -- ...and reduces what the payee is owed
    select s.to_user as user_id, -s.amount_paisa as delta_paisa
    from public.settlements s
    where s.group_id = p_group_id
  ) as deltas
  group by deltas.user_id
  having sum(deltas.delta_paisa) <> 0;
end;
$$;

revoke execute on function public.get_group_balances(uuid) from anon;
grant execute on function public.get_group_balances(uuid) to authenticated;

comment on function public.get_group_balances(uuid) is
  'Returns each member''s net balance (paisa) for the given group. '
  'Positive = the user is owed money; negative = the user owes. Raises '
  '42501 not_group_member if the caller is not a current member. '
  'SECURITY DEFINER + explicit membership check; safe to call from the '
  'authenticated role.';
