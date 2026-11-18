import { createClient } from 'npm:@supabase/supabase-js@2';
import { isSpinErrorCode, SpinErrorCode } from '../_shared/errors.ts';
import { isValidBet } from '../_shared/money.ts';
import { evaluateWin, MATH_VERSION, matrixFromStops, randomStops } from '../_shared/slotMath.ts';

const GAME_VERSION = '1.0.0';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ERROR_STATUS: Record<SpinErrorCode, number> = {
  NOT_AUTHENTICATED: 401,
  INVALID_REQUEST: 400,
  INVALID_BET: 400,
  INSUFFICIENT_FUNDS: 400,
  PROFILE_NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('NOT_AUTHENTICATED');
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return errorResponse('NOT_AUTHENTICATED');
    }

    const body = await readBody(req);
    if (!body) {
      return errorResponse('INVALID_REQUEST');
    }

    const requestId = typeof body.requestId === 'string' ? body.requestId : '';
    if (!UUID_PATTERN.test(requestId)) {
      return errorResponse('INVALID_REQUEST');
    }

    // Bets and wins are integers in minor units.
    const bet = body.bet;
    if (!isValidBet(bet)) {
      return errorResponse('INVALID_BET');
    }

    // Balance and profile checks live in apply_round, under the row lock.
    // A check here would wrongly reject a retry of a round that already went through.

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
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
      return errorResponse('INTERNAL_ERROR');
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: applied, error: applyError } = await admin.rpc('apply_round', {
      p_user_id: user.id,
      p_request_id: requestId,
      p_bet: bet,
      p_win_amount: winAmount,
      p_steps: steps,
      p_seed: seed,
      p_game_version: GAME_VERSION,
      p_math_version: MATH_VERSION,
    });

    if (applyError) {
      // apply_round raises its error code as the exception message.
      if (isSpinErrorCode(applyError.message)) {
        return errorResponse(applyError.message);
      }
      console.error('apply_round failed', applyError);
      return errorResponse('INTERNAL_ERROR');
    }

    const row = Array.isArray(applied) ? applied[0] : applied;
    if (!row?.round_id) {
      console.error('apply_round returned no round', applied);
      return errorResponse('INTERNAL_ERROR');
    }

    // For a repeated request id these are the stored round's values, not the ones drawn above.
    const roundSteps = row.round_steps as typeof steps;
    const firstStep = roundSteps[0];

    return json({
      matrix: firstStep.matrix,
      stops: firstStep.stops,
      winAmount: Number(row.round_win),
      winningCells: firstStep.winningCells,
      lines: firstStep.lines ?? [],
      balance: Number(row.balance),
      totalWin: Number(row.total_win),
      roundId: row.round_id,
      seed: row.round_seed,
      steps: roundSteps,
      gameVersion: row.round_game_version,
      mathVersion: row.round_math_version,
      repeated: Boolean(row.is_repeat),
    });
  } catch (error) {
    console.error('spin failed', error);
    return errorResponse('INTERNAL_ERROR');
  }
});

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function createRoundSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function errorResponse(code: SpinErrorCode): Response {
  return json({ error: code }, ERROR_STATUS[code]);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
