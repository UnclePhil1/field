import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';

const MAXG = 5;              // grid priced on the board (0-0 … 5-5)
const BASE_LAMBDA = 1.35;    // baseline goals per team
const PRIOR_STRENGTH = 200;  // how much the model counts vs. real stakes
const MIN_MULT = 1.2, MAX_MULT = 250;

function pois(k: number, lambda: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}
function tagFor(prob: number): string {
  if (prob >= 0.15) return 'Favored';
  if (prob >= 0.07) return 'Hot Pick';
  return 'Moonshot';
}

function priceBoard(sideHomeShare: number, pool: Map<string, number>): Map<string, number> {
  const lamH = BASE_LAMBDA * (0.7 + 0.6 * sideHomeShare);
  const lamA = BASE_LAMBDA * (0.7 + 0.6 * (1 - sideHomeShare));
  const prior = new Map<string, number>();
  let priorSum = 0;
  for (let h = 0; h <= MAXG; h++) {
    for (let a = 0; a <= MAXG; a++) {
      const p = pois(h, lamH) * pois(a, lamA);
      prior.set(`${h}-${a}`, p);
      priorSum += p;
    }
  }
  const weight = new Map<string, number>();
  let wSum = 0;
  for (const [key, p] of prior) {
    const w = (p / priorSum) * PRIOR_STRENGTH + (pool.get(key) ?? 0);
    weight.set(key, w);
    wSum += w;
  }
  const probs = new Map<string, number>();
  for (const [key, w] of weight) probs.set(key, w / wSum);
  return probs;
}

function multiplierOf(prob: number): number {
  return Math.min(MAX_MULT, Math.max(MIN_MULT, 1 / prob));
}

// deno-lint-ignore no-explicit-any
async function poolFor(db: any, matchId: string): Promise<Map<string, number>> {
  const { data } = await db.from('score_link_picks').select('home_goals, away_goals, stake').eq('match_id', matchId);
  const pool = new Map<string, number>();
  for (const r of data ?? []) pool.set(`${r.home_goals}-${r.away_goals}`, (pool.get(`${r.home_goals}-${r.away_goals}`) ?? 0) + r.stake);
  return pool;
}

// deno-lint-ignore no-explicit-any
async function sideShare(db: any, matchId: string): Promise<number> {
  const { data } = await db.from('match_predictions').select('side').eq('match_id', matchId);
  const home = (data ?? []).filter((r: any) => r.side === 'home').length;
  const total = (data ?? []).length;
  return total > 0 ? home / total : 0.5;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const db = admin();
  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const matchId = url.searchParams.get('matchId');
      if (!matchId) return json({ error: 'matchId required' }, 400);
      const user = await getUser(req);
      const [pool, share] = await Promise.all([poolFor(db, matchId), sideShare(db, matchId)]);
      const probs = priceBoard(share, pool);
      const scorelines = [...probs.entries()]
        .map(([key, prob]) => {
          const [h, a] = key.split('-').map(Number);
          const multiplier = Math.round(multiplierOf(prob) * 100) / 100;
          return { homeGoals: h, awayGoals: a, multiplier, entryCents: Math.round((100 / multiplier) * 10) / 10, tag: tagFor(prob) };
        })
        .sort((x, y) => y.multiplier - x.multiplier === 0 ? 0 : x.multiplier - y.multiplier); // favored (low mult) first

      let mine: unknown[] = [];
      let coins = 0;
      if (user) {
        const { data: picks } = await db
          .from('score_link_picks')
          .select('home_goals, away_goals, stake, multiplier, entry_cents, settled, won, payout')
          .eq('match_id', matchId)
          .eq('user_id', user.id);
        mine = (picks ?? []).map((p: any) => ({
          homeGoals: p.home_goals, awayGoals: p.away_goals, stake: p.stake,
          multiplier: Number(p.multiplier), entryCents: Number(p.entry_cents),
          settled: p.settled, won: p.won, payout: p.payout,
        }));
        const { data: prof } = await db.from('profiles').select('coins').eq('id', user.id).maybeSingle();
        coins = prof?.coins ?? 0;
      }
      return json({ scorelines, mine, coins });
    }

    if (req.method === 'POST') {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { matchId, homeGoals, awayGoals, stake } = await req.json();
      const h = Number(homeGoals), a = Number(awayGoals), s = Math.floor(Number(stake));
      if (!matchId || !(h >= 0 && h <= 9 && a >= 0 && a <= 9)) return json({ error: 'invalid scoreline' }, 400);
      if (!(s > 0)) return json({ error: 'stake must be greater than 0' }, 400);

      const { data: match } = await db.from('matches').select('status').eq('id', matchId).maybeSingle();
      if (!match) return json({ error: 'match not found' }, 404);
      if (match.status !== 'upcoming') return json({ error: 'the match has started — picks are closed' }, 409);

      const { data: prof } = await db.from('profiles').select('coins').eq('id', user.id).maybeSingle();
      if (!prof || prof.coins < s) return json({ error: 'not enough coins' }, 400);

      const [pool, share] = await Promise.all([poolFor(db, matchId), sideShare(db, matchId)]);
      const probs = priceBoard(share, pool);
      const prob = probs.get(`${Math.min(h, MAXG)}-${Math.min(a, MAXG)}`) ?? (1 / (MAX_MULT));
      const multiplier = Math.round(multiplierOf(prob) * 100) / 100;
      const entryCents = Math.round((100 / multiplier) * 10) / 10;

      const { data: existing } = await db.from('score_link_picks')
        .select('id').eq('match_id', matchId).eq('user_id', user.id).limit(1).maybeSingle();
      if (existing) return json({ error: 'you’ve already made your Score Link pick for this match' }, 409);

      await db.from('profiles').update({ coins: prof.coins - s }).eq('id', user.id);
      const { error } = await db.from('score_link_picks').insert({
        match_id: matchId, user_id: user.id, home_goals: h, away_goals: a, stake: s, multiplier, entry_cents: entryCents,
      });
      if (error) { await db.from('profiles').update({ coins: prof.coins }).eq('id', user.id); throw error; }

      return json({ ok: true, multiplier, entryCents, payoutIfWin: Math.round(s * multiplier) });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
