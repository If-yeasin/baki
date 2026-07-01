set search_path = public;

create or replace function public.simplify_debts(p_group_id uuid)
returns table(from_user uuid, to_user uuid, amount_paisa bigint)
language plpgsql
volatile
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
    set amount_paisa = baki_debtors.amount_paisa - transfer_amount
    where user_id = debtor.user_id;

    update baki_creditors
    set amount_paisa = baki_creditors.amount_paisa - transfer_amount
    where user_id = creditor.user_id;

    delete from baki_debtors where baki_debtors.amount_paisa = 0;
    delete from baki_creditors where baki_creditors.amount_paisa = 0;
  end loop;
end;
$$;

revoke execute on function public.simplify_debts(uuid) from anon;
grant execute on function public.simplify_debts(uuid) to authenticated;

comment on function public.simplify_debts(uuid) is
  'Returns a minimum-transfer settlement plan for the group. VOLATILE because '
  'the implementation uses session-local temporary tables; guarded by group '
  'membership and safe for authenticated mobile clients.';
