import { createClient } from 'npm:@supabase/supabase-js@2';
import { evaluateWin, MATH_VERSION, matrixFromStops, randomStops } from '../_shared/slotMath.ts';

const BET_OPTIONS = [1.5, 3, 5, 8, 10, 15, 20, 30, 50];
const GAME_VERSION = '1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'NOT_AUTHENTICATED' }, 401);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: 'NOT_AUTHENTICATED' }, 401);
    }

    const { error: cleanupError } = await supabase.rpc('cleanup_stale_demo_data');
    if (cleanupError) {
      console.error('cleanup_stale_demo_data failed', cleanupError.message);
    }

    const body = (await req.json()) as { bet?: unknown };
    const bet = Number(body.bet);
    if (!BET_OPTIONS.includes(bet)) {
      return json({ error: 'INVALID_BET' }, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance, spin_count')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return json({ error: 'PROFILE_NOT_FOUND' }, 404);
    }
    if (Number(profile.balance) < bet) {
      return json({ error: 'INSUFFICIENT_FUNDS' }, 400);
    }

    const stops = randomStops();
    const matrix = matrixFromStops(stops);
    const { winAmount, winningCells, lines } = evaluateWin(matrix, bet);
    const steps = [
      {
        type: 'base',
        stops,
        matrix,
        winningCells,
        lines,
        win: winAmount,
      },
    ];
    const seed = createRoundSeed();

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      return json({ error: 'SERVICE_ROLE_MISSING' }, 500);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: applied, error: applyError } = await admin.rpc('apply_round', {
      p_user_id: user.id,
      p_bet: bet,
      p_win_amount: winAmount,
      p_steps: steps,
      p_seed: seed,
      p_game_version: GAME_VERSION,
      p_math_version: MATH_VERSION,
    });

    if (applyError) {
      return json({ error: applyError.message }, 400);
    }

    const row = Array.isArray(applied) ? applied[0] : applied;
    if (!row?.round_id) {
      return json({ error: 'APPLY_FAILED' }, 500);
    }

    return json({
      matrix,
      stops,
      winAmount,
      winningCells,
      lines,
      balance: Number(row.balance),
      totalWin: Number(row.total_win),
      roundId: row.round_id,
      seed,
      steps,
      gameVersion: GAME_VERSION,
      mathVersion: MATH_VERSION,
    });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});

function createRoundSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
