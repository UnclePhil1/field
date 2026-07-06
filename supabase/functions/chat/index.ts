// chat — guarded sends for match + squad chat.
//   POST /chat         { scope, scopeId, body }  -> send a message
//   POST /chat/report  { messageId }             -> flag a message
// Reads happen client-side over Realtime (RLS controls who sees squad chat).
import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';

const MAX_LEN = 240;
const BURST_LIMIT = 5;       // messages per window
const WINDOW_MS = 15_000;
const MIN_GAP_MS = 1_500;

// A small, deliberately short block list — masks the word rather than rejecting.
const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot', 'asshole'];
function clean(text: string): string {
  let out = text;
  for (const w of BLOCKED) {
    out = out.replace(new RegExp(w, 'gi'), (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
  }
  return out;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const db = admin();
  const url = new URL(req.url);
  const seg = url.pathname.split('/').filter(Boolean);
  const isReport = seg[seg.indexOf('chat') + 1] === 'report';

  const user = await getUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  try {
    if (isReport) {
      const { messageId } = await req.json();
      if (!messageId) return json({ error: 'messageId required' }, 400);
      await db.from('chat_reports').upsert({ message_id: messageId, reporter_id: user.id }, { onConflict: 'message_id,reporter_id' });
      return json({ ok: true });
    }

    const { scope, scopeId, body } = await req.json();
    if ((scope !== 'match' && scope !== 'squad') || !scopeId) return json({ error: 'scope and scopeId required' }, 400);
    const text = String(body ?? '').trim();
    if (!text) return json({ error: 'empty message' }, 400);
    if (text.length > MAX_LEN) return json({ error: `Keep it under ${MAX_LEN} characters` }, 400);

    // squad chat: caller must be a member of that squad
    if (scope === 'squad') {
      const { data: squad } = await db.from('squads').select('id').eq('invite_code', scopeId).maybeSingle();
      if (!squad) return json({ error: 'squad not found' }, 404);
      const { data: mem } = await db.from('squad_members').select('user_id').eq('squad_id', squad.id).eq('user_id', user.id).maybeSingle();
      if (!mem) return json({ error: 'join the squad to chat' }, 403);
    } else {
      // match chat: the match must exist
      const { data: match } = await db.from('matches').select('id').eq('id', scopeId).maybeSingle();
      if (!match) return json({ error: 'match not found' }, 404);
    }

    // rate limit
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data: recent } = await db
      .from('chat_messages')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if ((recent?.length ?? 0) >= BURST_LIMIT) return json({ error: 'You’re sending too fast — slow down.' }, 429);
    if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < MIN_GAP_MS) {
      return json({ error: 'One moment between messages.' }, 429);
    }

    const { data: prof } = await db.from('profiles').select('username, wallet').eq('id', user.id).maybeSingle();
    const name = prof?.username ?? (prof?.wallet ? prof.wallet.slice(0, 6) : 'anon');

    const { error } = await db.from('chat_messages').insert({ scope, scope_id: scopeId, user_id: user.id, name, body: clean(text) });
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
