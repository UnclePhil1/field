// place-call — server-authoritative wager. The client never settles its own
// calls; it only records a pick + stake here while the card is still open.
import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { cardId?: string; pick?: 'yes' | 'no'; stake?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const { cardId, pick, stake } = body;
  if (!cardId || (pick !== 'yes' && pick !== 'no') || !stake || stake <= 0) {
    return json({ error: 'cardId, pick (yes|no) and positive stake are required' }, 400);
  }

  const db = admin();

  // Card must still be open.
  const { data: card } = await db
    .from('prediction_cards')
    .select('id, status, locks_at')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) return json({ error: 'card not found' }, 404);
  if (card.status !== 'live' || new Date(card.locks_at).getTime() <= Date.now()) {
    return json({ error: 'card is locked' }, 409);
  }

  // User must have enough coins to cover the stake.
  const { data: profile } = await db.from('profiles').select('coins').eq('id', user.id).maybeSingle();
  if (!profile) return json({ error: 'profile not found' }, 404);
  if (profile.coins < stake) return json({ error: 'insufficient coins' }, 402);

  // One call per card per user.
  const { error: insErr } = await db.from('predictions').insert({
    card_id: cardId,
    user_id: user.id,
    pick,
    stake,
  });
  if (insErr) {
    if (insErr.code === '23505') return json({ error: 'already called this card' }, 409);
    return json({ error: insErr.message }, 500);
  }

  // Refresh the crowd split off live calls so other clients see it move.
  const { count: total } = await db
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId);
  const { count: yes } = await db
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId)
    .eq('pick', 'yes');
  if (total && total > 0) {
    await db
      .from('prediction_cards')
      .update({ crowd_yes: Math.round(((yes ?? 0) / total) * 100) })
      .eq('id', cardId);
  }

  return json({ ok: true });
});
