-- Each spin carries a client request id. apply_round applies a request id once per player
-- and answers a repeat with the stored round, so the client can safely retry after a
-- network failure without a second debit.

alter table public.rounds add column if not exists request_id uuid;

create unique index if not exists rounds_user_request_idx
  on public.rounds (user_id, request_id)
  where request_id is not null;

drop function if exists public.apply_round(uuid, numeric, numeric, jsonb, text, text, text);

create function public.apply_round(
  p_user_id uuid,
  p_request_id uuid,
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
  total_win numeric,
  is_repeat boolean,
  round_bet numeric,
  round_win numeric,
  round_steps jsonb,
  round_seed text,
  round_game_version text,
  round_math_version text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_balance_before numeric;
  v_balance numeric;
  v_total_win numeric;
  v_round_id uuid;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  if p_request_id is null then
    raise exception 'INVALID_REQUEST';
  end if;

  if p_bet not in (1.5, 3, 5, 8, 10, 15, 20, 30, 50) then
    raise exception 'INVALID_BET';
  end if;

  if p_win_amount < 0 then
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

  if jsonb_typeof(p_steps->0->'stops') is distinct from 'array'
     or jsonb_array_length(p_steps->0->'stops') <> 4
     or exists (
       select 1
       from jsonb_array_elements(p_steps->0->'stops') as stop
       where jsonb_typeof(stop) <> 'number'
     ) then
    raise exception 'INVALID_STOPS';
  end if;

  -- The row lock serializes all rounds of one player, including concurrent retries.
  select p.balance
    into v_balance_before
  from public.profiles as p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  -- A repeated request id returns the stored round instead of playing a new one.
  return query
  select r.id, p.balance, p.total_win, true, r.bet, r.total_win, r.steps, r.seed, r.game_version, r.math_version
  from public.rounds as r
  join public.profiles as p on p.id = r.user_id
  where r.user_id = p_user_id
    and r.request_id = p_request_id;

  if found then
    return;
  end if;

  if v_balance_before < p_bet then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.profiles as p
  set
    balance = p.balance - p_bet + p_win_amount,
    total_win = p.total_win + p_win_amount,
    spin_count = p.spin_count + 1
  where p.id = p_user_id
  returning p.balance, p.total_win
  into v_balance, v_total_win;

  insert into public.rounds (
    user_id,
    request_id,
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
    p_request_id,
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
  select v_round_id, v_balance, v_total_win, false, p_bet, p_win_amount, p_steps, p_seed, p_game_version, p_math_version;
end;
$$;

revoke all on function public.apply_round(uuid, uuid, numeric, numeric, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_round(uuid, uuid, numeric, numeric, jsonb, text, text, text)
  to service_role;
