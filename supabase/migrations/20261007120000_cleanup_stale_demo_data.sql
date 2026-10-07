create or replace function public.cleanup_stale_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users
  where created_at < now() - interval '24 hours'
    and is_anonymous is true
    and id is distinct from auth.uid();

  delete from public.spins
  where created_at < now() - interval '24 hours';
end;
$$;

revoke all on function public.cleanup_stale_demo_data() from public;
grant execute on function public.cleanup_stale_demo_data() to authenticated;
