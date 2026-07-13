import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';

function newCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// deno-lint-ignore no-explicit-any
async function standings(db: any, squadId: string, matchId: string, meId: string | null) {
  const { data: members } = await db
    .from('squad_members')
    .select('user_id, joined_at, profiles(username, wallet, streak)')
    .eq('squad_id', squadId)
    .order('joined_at', { ascending: true });
  const ids = (members ?? []).map((m: any) => m.user_id);
  if (ids.length === 0) return [];

  const { data: cards } = await db.from('prediction_cards').select('id').eq('match_id', matchId);
  const cardIds = (cards ?? []).map((c: any) => c.id);
  const pts: Record<string, number> = {};
  if (cardIds.length) {
    const { data: setts } = await db
      .from('settlements')
      .select('user_id, points')
      .in('card_id', cardIds)
      .in('user_id', ids);
    for (const s of setts ?? []) pts[s.user_id] = (pts[s.user_id] ?? 0) + (s.points ?? 0);
  }

  return (members ?? [])
    .map((m: any) => ({
      userId: m.user_id,
      name: m.profiles?.username ?? (m.profiles?.wallet ? m.profiles.wallet.slice(0, 6) : 'anon'),
      streak: m.profiles?.streak ?? 0,
      points: pts[m.user_id] ?? 0,
      isMe: meId === m.user_id,
    }))
    .sort((a: any, b: any) => b.points - a.points)
    .map((r: any, i: number) => ({ ...r, rank: i + 1 }));
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const db = admin();
  const url = new URL(req.url);
  const seg = url.pathname.split('/').filter(Boolean);
  const i = seg.indexOf('squads');
  const path = i >= 0 ? seg.slice(i + 1) : seg;
  const method = req.method;

  try {
    if (method === 'GET' && path[0] === 'mine') {
      const user = await getUser(req);
      if (!user) return json({ squad: null });
      const matchId = url.searchParams.get('matchId');
      if (!matchId) return json({ squad: null });
      const { data: mine } = await db
        .from('squad_members')
        .select('squad_id, squads!inner(invite_code, match_id, name)')
        .eq('user_id', user.id);
      // deno-lint-ignore no-explicit-any
      const row = (mine ?? []).find((m: any) => m.squads?.match_id === matchId);
      // deno-lint-ignore no-explicit-any
      return json({ squad: row ? { code: (row as any).squads.invite_code, name: (row as any).squads.name } : null });
    }

    if (method === 'POST' && path.length === 0) {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { matchId } = await req.json();
      if (!matchId) return json({ error: 'matchId required' }, 400);
      const { data: match } = await db.from('matches').select('id').eq('id', matchId).maybeSingle();
      if (!match) return json({ error: 'match not found' }, 404);

      const { data: existing } = await db
        .from('squads')
        .select('*')
        .eq('owner_id', user.id)
        .eq('match_id', matchId)
        .maybeSingle();
      let squad = existing;
      if (!squad) {
        const { data: prof } = await db.from('profiles').select('username, wallet').eq('id', user.id).maybeSingle();
        const who = prof?.username ?? (prof?.wallet ? prof.wallet.slice(0, 6) : 'my');
        const { data, error } = await db
          .from('squads')
          .insert({ match_id: matchId, owner_id: user.id, name: `${who}'s squad`, invite_code: newCode() })
          .select('*')
          .single();
        if (error) throw error;
        squad = data;
      }
      await db.from('squad_members').upsert({ squad_id: squad.id, user_id: user.id }, { onConflict: 'squad_id,user_id' });
      return json({ code: squad.invite_code, name: squad.name, matchId });
    }

    const code = path[0];
    if (!code) return json({ error: 'not found' }, 404);

    if (method === 'POST' && path[1] === 'join') {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { data: squad } = await db.from('squads').select('*').eq('invite_code', code).maybeSingle();
      if (!squad) return json({ error: 'squad not found' }, 404);
      await db.from('squad_members').upsert({ squad_id: squad.id, user_id: user.id }, { onConflict: 'squad_id,user_id' });
      return json({ code: squad.invite_code, name: squad.name, matchId: squad.match_id });
    }

    if (method === 'GET' && path.length === 1) {
      const user = await getUser(req);
      const { data: squad } = await db.from('squads').select('*').eq('invite_code', code).maybeSingle();
      if (!squad) return json({ error: 'not found' }, 404);
      const { data: match } = await db
        .from('matches')
        .select('id, home_code, away_code, home_name, away_name, home_country, away_country, status, competition, stage, kickoff')
        .eq('id', squad.match_id)
        .maybeSingle();
      const board = await standings(db, squad.id, squad.match_id, user?.id ?? null);
      return json({
        code: squad.invite_code,
        name: squad.name,
        matchId: squad.match_id,
        ownerId: squad.owner_id,
        memberCount: board.length,
        joined: user ? board.some((b) => b.isMe) : false,
        match,
        standings: board,
      });
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
