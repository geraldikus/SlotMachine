-- Security fix: remove the legacy spin path.
--
-- apply_spin was SECURITY DEFINER, executable by anon and authenticated, and took the win
-- amount from the caller. Any player could call it through RPC and credit any balance.
-- Spins have gone through the spin Edge Function and apply_round for a while, and nothing
-- reads the spins table anymore.

drop function if exists public.apply_spin(numeric, numeric, jsonb, jsonb);

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
end;
$$;

drop table if exists public.spins;

-- Players only read their own profile. Writes go through apply_round with the service role.
-- RLS already blocks writes; dropping the grants makes that explicit.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
