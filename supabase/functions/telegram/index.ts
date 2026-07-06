// telegram — user-facing link management for the Telegram notification channel.
//   POST /telegram/link    → mint a one-time code + deep link to start the bot
//   GET  /telegram/status  → { connected, tg_username }
//   POST /telegram/unlink  → disconnect this account's Telegram
// Auth is the caller's Supabase session (getUser). Sends themselves are done by
// the engine/tournaments functions via the service role.
import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';

const BOT_USERNAME = (Deno.env.get('TELEGRAM_BOT_USERNAME') ?? '').replace(/^@/, '');
const CODE_TTL_MS = 15 * 60 * 1000;

function newCode(): string {
  // URL-safe, unambiguous, short enough to type after /start.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const user = await getUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const db = admin();
  const path = new URL(req.url).pathname.replace(/^.*\/telegram/, '') || '/';

  // ── status ──
  if (req.method === 'GET') {
    const { data } = await db.from('telegram_links').select('tg_username, linked_at').eq('user_id', user.id).maybeSingle();
    return json({ connected: !!data, tg_username: data?.tg_username ?? null });
  }

  if (req.method === 'POST' && path === '/unlink') {
    await db.from('telegram_links').delete().eq('user_id', user.id);
    return json({ ok: true, connected: false });
  }

  if (req.method === 'POST' && path === '/link') {
    if (!BOT_USERNAME) return json({ error: 'Telegram bot not configured' }, 503);
    // Reuse an unexpired code if one exists so rapid taps don't pile up rows.
    await db.from('telegram_link_codes').delete().eq('user_id', user.id);
    const code = newCode();
    const expires_at = new Date(Date.now() + CODE_TTL_MS).toISOString();
    const { error } = await db.from('telegram_link_codes').insert({ code, user_id: user.id, expires_at });
    if (error) return json({ error: error.message }, 500);
    return json({
      code,
      url: `https://t.me/${BOT_USERNAME}?start=${code}`,
      bot: BOT_USERNAME,
      expiresAt: expires_at,
    });
  }

  return json({ error: 'not found' }, 404);
});
