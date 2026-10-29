create table if not exists public.rounds (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  status         text not null check (status in ('in_progress', 'completed')),
  game_version   text not null,
  math_version   text not null,
  seed           text not null,
  bet            numeric not null,
  total_win      numeric not null default 0,
  balance_before numeric not null,
  balance_after  numeric,
  steps          jsonb not null
);

create index if not exists rounds_user_created_idx
  on public.rounds (user_id, created_at desc);

create index if not exists rounds_created_at_idx
  on public.rounds (created_at);

alter table public.rounds enable row level security;

drop policy if exists rounds_select_own on public.rounds;
create policy rounds_select_own
  on public.rounds
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.rounds from anon, authenticated;
grant select on table public.rounds to authenticated;

create or replace function public.apply_round(
  p_user_id uuid,
  p_bet numeric,
  p_win_amount numeric,
  p_steps jsonb,
  p_seed text,
  p_game_version text,
  p_math_version text
)
returns table (
  round_id uuid,
  balance numeric,
  total_win numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance_before numeric;
  v_balance numeric;
  v_total_win numeric;
  v_round_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  if p_bet not in (1.5, 3, 5, 8, 10, 15, 20, 30, 50) then
    raise exception 'INVALID_BET';
  end if;

  if p_win_amount < 0 or (p_win_amount <> 0 and p_win_amount <> p_bet * 3) then
    raise exception 'INVALID_WIN';
  end if;

  if p_seed is null or length(trim(p_seed)) = 0
     or p_game_version is null or length(trim(p_game_version)) = 0
     or p_math_version is null or length(trim(p_math_version)) = 0 then
    raise exception 'INVALID_ROUND_META';
  end if;

  if jsonb_typeof(p_steps) is distinct from 'array'
     or jsonb_array_length(p_steps) < 1 then
    raise exception 'INVALID_STEPS';
  end if;

  select p.balance
    into v_balance_before
  from public.profiles as p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_balance_before < p_bet then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.profiles
  set
    balance = balance - p_bet + p_win_amount,
    total_win = total_win + p_win_amount,
    spin_count = spin_count + 1
  where id = p_user_id
  returning profiles.balance, profiles.total_win
  into v_balance, v_total_win;

  insert into public.rounds (
    user_id,
    status,
    completed_at,
    game_version,
    math_version,
    seed,
    bet,
    total_win,
    balance_before,
    balance_after,
    steps
  ) values (
    p_user_id,
    'completed',
    now(),
    p_game_version,
    p_math_version,
    p_seed,
    p_bet,
    p_win_amount,
    v_balance_before,
    v_balance,
    p_steps
  )
  returning id into v_round_id;

  return query
  select v_round_id, v_balance, v_total_win;
end;
$$;

revoke all on function public.apply_round(uuid, numeric, numeric, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_round(uuid, numeric, numeric, jsonb, text, text, text)
  to service_role;

create or replace function public.cleanup_stale_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rounds
  where created_at < now() - interval '24 hours';

  delete from auth.users
  where created_at < now() - interval '24 hours'
    and is_anonymous is true
    and id is distinct from auth.uid();

  delete from public.spins
  where created_at < now() - interval '24 hours';
end;
$$;
