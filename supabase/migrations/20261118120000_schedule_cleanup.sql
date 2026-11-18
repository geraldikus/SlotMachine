-- Stale demo data is removed by a scheduled job instead of on every spin.
-- Players can no longer call the cleanup function through RPC.

revoke all on function public.cleanup_stale_demo_data() from public, anon, authenticated;
grant execute on function public.cleanup_stale_demo_data() to service_role;

create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-stale-demo-data',
  '0 * * * *',
  $$select public.cleanup_stale_demo_data();$$
);
