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
