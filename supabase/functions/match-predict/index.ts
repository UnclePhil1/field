import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';

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
      const { data: rows } = await db
        .from('match_predictions')
        .select('user_id, home_goals, away_goals, side, settled, points')
        .eq('match_id', matchId);
      const home = (rows ?? []).filter((r) => r.side === 'home').length;
      const away = (rows ?? []).filter((r) => r.side === 'away').length;
      const mineRow = user ? (rows ?? []).find((r) => r.user_id === user.id) : null;
      const mine = mineRow
        ? { homeGoals: mineRow.home_goals, awayGoals: mineRow.away_goals, side: mineRow.side, settled: mineRow.settled, points: mineRow.points }
        : null;
      return json({ mine, fanWar: { home, away } });
    }

    if (req.method === 'POST') {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { matchId, homeGoals, awayGoals, side } = await req.json();
      if (!matchId || side !== 'home' && side !== 'away') return json({ error: 'matchId and side required' }, 400);
      const hg = Number(homeGoals), ag = Number(awayGoals);
      if (!(hg >= 0 && hg <= 20 && ag >= 0 && ag <= 20)) return json({ error: 'score out of range' }, 400);

      const { data: match } = await db.from('matches').select('status').eq('id', matchId).maybeSingle();
      if (!match) return json({ error: 'match not found' }, 404);
      if (match.status !== 'upcoming') return json({ error: 'predictions closed — the match has started' }, 409);

      const { error } = await db
        .from('match_predictions')
        .upsert({ match_id: matchId, user_id: user.id, home_goals: hg, away_goals: ag, side }, { onConflict: 'match_id,user_id' });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
