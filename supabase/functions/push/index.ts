import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';
import { notifyUser } from '../_shared/fcm.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const user = await getUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const db = admin();
  const url = new URL(req.url);
  const seg = url.pathname.split('/').filter(Boolean);
  const i = seg.indexOf('push');
  const path = i >= 0 ? seg.slice(i + 1) : seg;

  try {
    if (req.method === 'POST' && path[0] === 'register') {
      const { token, platform = 'web', userAgent } = await req.json();
      if (!token) return json({ error: 'token required' }, 400);
      const { error } = await db.from('push_tokens').upsert(
        { token, user_id: user.id, platform, user_agent: userAgent ?? null, last_seen_at: new Date().toISOString() },
        { onConflict: 'token' },
      );
      if (error) throw error;
      await db.from('notification_preferences').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
      return json({ ok: true });
    }

    if (req.method === 'POST' && path[0] === 'test') {
      const { count } = await db
        .from('push_tokens')
        .select('token', { count: 'exact', head: true })
        .eq('user_id', user.id);
      const configured = !!Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
      await notifyUser(db, user.id, {
        title: '🔔 Field',
        body: 'Push notifications are working.',
        url: '/you',
        tag: 'test',
      });
      return json({ ok: true, tokens: count ?? 0, configured });
    }

    if (req.method === 'POST' && path[0] === 'unregister') {
      const { token } = await req.json();
      if (!token) return json({ error: 'token required' }, 400);
      await db.from('push_tokens').delete().eq('token', token).eq('user_id', user.id);
      return json({ ok: true });
    }

    if (req.method === 'GET' && path[0] === 'preferences') {
      const { data } = await db.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
      return json(data ?? { user_id: user.id });
    }

    if (req.method === 'PUT' && path[0] === 'preferences') {
      const body = await req.json();
      const row: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
      for (const k of ['enabled', 'match_events', 'my_play', 'tournaments', 'followed']) {
        if (k in body) row[k] = body[k];
      }
      const { data, error } = await db
        .from('notification_preferences')
        .upsert(row, { onConflict: 'user_id' })
        .select('*')
        .single();
      if (error) throw error;
      return json(data);
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
