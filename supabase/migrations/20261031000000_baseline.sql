-- Baseline: the schema as it exists in the linked project on 2026-11-18,
-- taken with `supabase db dump --linked --schema public`.
-- It replaces the earlier migrations, which had been edited after they were applied
-- and did not include the tables created in the dashboard.
-- Later changes go into new migration files only.

CREATE OR REPLACE FUNCTION "public"."apply_round"("p_user_id" "uuid", "p_bet" numeric, "p_win_amount" numeric, "p_steps" "jsonb", "p_seed" "text", "p_game_version" "text", "p_math_version" "text") RETURNS TABLE("round_id" "uuid", "balance" numeric, "total_win" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_balance_before numeric;
  v_balance numeric;
  v_total_win numeric;
  v_round_id uuid;
  v_stops jsonb;
  v_i int;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
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

  v_stops := p_steps -> 0 -> 'stops';
  if jsonb_typeof(v_stops) is distinct from 'array'
     or jsonb_array_length(v_stops) is distinct from 4 then
    raise exception 'INVALID_STOPS';
  end if;

  for v_i in 0..3 loop
    if jsonb_typeof(v_stops -> v_i) is distinct from 'number' then
      raise exception 'INVALID_STOPS';
    end if;
  end loop;

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

CREATE OR REPLACE FUNCTION "public"."apply_spin"("p_bet" numeric, "p_win_amount" numeric, "p_matrix" "jsonb", "p_winning_cells" "jsonb") RETURNS TABLE("balance" numeric, "total_win" numeric, "spin_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  update public.profiles
  set
    balance = profiles.balance - p_bet + p_win_amount,
    total_win = profiles.total_win + p_win_amount,
    spin_count = profiles.spin_count + 1
  where id = v_user_id
    and profiles.balance >= p_bet
  returning profiles.balance, profiles.total_win, profiles.spin_count
  into balance, total_win, spin_count;

  if not found then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  insert into public.spins (user_id, bet, win_amount, matrix, winning_cells)
  values (v_user_id, p_bet, p_win_amount, p_matrix, p_winning_cells);

  return next;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."cleanup_stale_demo_data"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "balance" numeric DEFAULT 1000 NOT NULL,
    "total_win" numeric DEFAULT 0 NOT NULL,
    "spin_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "status" "text" NOT NULL,
    "game_version" "text" NOT NULL,
    "math_version" "text" NOT NULL,
    "seed" "text" NOT NULL,
    "bet" numeric NOT NULL,
    "total_win" numeric DEFAULT 0 NOT NULL,
    "balance_before" numeric NOT NULL,
    "balance_after" numeric,
    "steps" "jsonb" NOT NULL,
    CONSTRAINT "rounds_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."spins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bet" numeric NOT NULL,
    "win_amount" numeric NOT NULL,
    "matrix" "jsonb" NOT NULL,
    "winning_cells" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rounds"
    ADD CONSTRAINT "rounds_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."spins"
    ADD CONSTRAINT "spins_pkey" PRIMARY KEY ("id");

CREATE INDEX "rounds_created_at_idx" ON "public"."rounds" USING "btree" ("created_at");

CREATE INDEX "rounds_user_created_idx" ON "public"."rounds" USING "btree" ("user_id", "created_at" DESC);

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rounds"
    ADD CONSTRAINT "rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."spins"
    ADD CONSTRAINT "spins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));

CREATE POLICY "read own spins" ON "public"."spins" FOR SELECT USING (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."rounds" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rounds_select_own" ON "public"."rounds" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

ALTER TABLE "public"."spins" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON FUNCTION "public"."apply_round"("p_user_id" "uuid", "p_bet" numeric, "p_win_amount" numeric, "p_steps" "jsonb", "p_seed" "text", "p_game_version" "text", "p_math_version" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_round"("p_user_id" "uuid", "p_bet" numeric, "p_win_amount" numeric, "p_steps" "jsonb", "p_seed" "text", "p_game_version" "text", "p_math_version" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."apply_spin"("p_bet" numeric, "p_win_amount" numeric, "p_matrix" "jsonb", "p_winning_cells" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_spin"("p_bet" numeric, "p_win_amount" numeric, "p_matrix" "jsonb", "p_winning_cells" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_spin"("p_bet" numeric, "p_win_amount" numeric, "p_matrix" "jsonb", "p_winning_cells" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."cleanup_stale_demo_data"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_stale_demo_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_stale_demo_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_stale_demo_data"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."rounds" TO "service_role";
GRANT SELECT ON TABLE "public"."rounds" TO "authenticated";

GRANT ALL ON TABLE "public"."spins" TO "anon";
GRANT ALL ON TABLE "public"."spins" TO "authenticated";
GRANT ALL ON TABLE "public"."spins" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- Every new auth user, anonymous included, gets a profile with the default balance.
-- The trigger lives in the auth schema, so the public dump does not include it.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
