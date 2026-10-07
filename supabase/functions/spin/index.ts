import { createClient } from 'npm:@supabase/supabase-js@2';
import { findWinLine, generateLosingMatrix, generateWinningMatrix } from './win.ts';

const SYMBOLS = [
  'strawberry',
  'red-cherry',
  'raspberry',
  'black-cherry',
  'black-berry-dark',
  'black-berry-light',
];
const BET_OPTIONS = [1.5, 3, 5, 8, 10, 15, 20, 30, 50];
const WIN_MULTIPLIER = 3;

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

    const nextCount = Number(profile.spin_count) + 1;
    const isWin = nextCount % 3 === 0;
    const matrix = isWin ? generateWinningMatrix(SYMBOLS).matrix : generateLosingMatrix(SYMBOLS);
    const winLine = findWinLine(matrix);
    const winAmount = winLine ? bet * WIN_MULTIPLIER : 0;

    const { data: applied, error: applyError } = await supabase.rpc('apply_spin', {
      p_bet: bet,
      p_win_amount: winAmount,
      p_matrix: matrix,
      p_winning_cells: winLine?.cells ?? [],
    });

    if (applyError) {
      return json({ error: applyError.message }, 400);
    }

    const row = Array.isArray(applied) ? applied[0] : applied;

    return json({
      matrix,
      winAmount,
      winningCells: winLine?.cells ?? [],
      balance: Number(row.balance),
      totalWin: Number(row.total_win),
    });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
