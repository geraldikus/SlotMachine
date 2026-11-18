-- Amounts move from numeric FUN to integer minor units (1 FUN = 100).
-- Integer math keeps balances and wins exact; only the client formats them as FUN.

alter table public.profiles
  alter column balance drop default,
  alter column balance type bigint using round(balance * 100)::bigint,
  alter column balance set default 100000,
  alter column total_win drop default,
  alter column total_win type bigint using round(total_win * 100)::bigint,
  alter column total_win set default 0;

alter table public.rounds
  alter column bet type bigint using round(bet * 100)::bigint,
  alter column total_win drop default,
  alter column total_win type bigint using round(total_win * 100)::bigint,
  alter column total_win set default 0,
  alter column balance_before type bigint using round(balance_before * 100)::bigint,
  alter column balance_after type bigint using round(balance_after * 100)::bigint;

-- Step wins are stored inside the steps array.
update public.rounds as r
set steps = (
  select jsonb_agg(
    case
      when step ? 'win'
        then jsonb_set(step, '{win}', to_jsonb(round((step->>'win')::numeric * 100)::bigint))
      else step
    end
    order by ordinality
  )
  from jsonb_array_elements(r.steps) with ordinality as s(step, ordinality)
);

drop function if exists public.apply_round(uuid, uuid, numeric, numeric, jsonb, text, text, text);

create function public.apply_round(
  p_user_id uuid,
  p_request_id uuid,
  p_bet bigint,
  p_win_amount bigint,
  p_steps jsonb,
  p_seed text,
  p_game_version text,
  p_math_version text
)
returns table (
  round_id uuid,
  balance bigint,
  total_win bigint,
  is_repeat boolean,
  round_bet bigint,
  round_win bigint,
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
  v_balance_before bigint;
  v_balance bigint;
  v_total_win bigint;
  v_round_id uuid;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  if p_request_id is null then
    raise exception 'INVALID_REQUEST';
  end if;

  if p_bet not in (150, 300, 500, 800, 1000, 1500, 2000, 3000, 5000) then
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

revoke all on function public.apply_round(uuid, uuid, bigint, bigint, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_round(uuid, uuid, bigint, bigint, jsonb, text, text, text)
  to service_role;
