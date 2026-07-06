// telegram-webhook — the endpoint Telegram calls with bot updates.
// Set it once with:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<FN_URL>&secret_token=<SECRET>"
// where <FN_URL> is this function's public URL and <SECRET> = TELEGRAM_WEBHOOK_SECRET.
//
// Users opt in by tapping the deep link from the app, which opens the bot and
// sends "/start <code>". We match the code to their account and store chat_id.
import { admin } from '../_shared/supabase.ts';
import { sendToChat } from '../_shared/telegram.ts';

const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

function ok(): Response {
  // Always 200 so Telegram doesn't retry; work happens before we return.
  return new Response('ok', { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok();
  // Reject anything not carrying our shared secret (Telegram echoes it back).
  if (WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  let update: Record<string, any> = {};
  try { update = await req.json(); } catch { return ok(); }

  const msg = update.message ?? update.edited_message;
  const chat = msg?.chat;
  if (!chat?.id || typeof msg.text !== 'string') return ok();

  const db = admin();
  const chatId = String(chat.id);
  const text: string = msg.text.trim();
  const tgUsername: string | null = msg.from?.username ?? null;

  // /start <code> — claim the one-time code and link this chat.
  if (text.startsWith('/start')) {
    const code = text.slice('/start'.length).trim().toUpperCase();
    if (!code) {
      await sendToChat(db, chatId, '👋 <b>Field</b> — open the app, go to <b>You → Connect Telegram</b>, and tap the link to get match alerts here.');
      return ok();
    }
    const { data: row } = await db
      .from('telegram_link_codes')
      .select('user_id, expires_at')
      .eq('code', code)
      .maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      await sendToChat(db, chatId, '⏳ That link expired. Head back to Field → <b>You → Connect Telegram</b> for a fresh one.');
      return ok();
    }
    // One chat per account and one account per chat: clear any prior owners.
    await db.from('telegram_links').delete().eq('chat_id', chatId);
    await db.from('telegram_links').delete().eq('user_id', row.user_id);
    await db.from('telegram_links').insert({ user_id: row.user_id, chat_id: chatId, tg_username: tgUsername });
    await db.from('telegram_link_codes').delete().eq('code', code);
    await sendToChat(db, chatId, '✅ <b>Connected!</b> You’ll get goals, cards, corners, prediction cards and tournament results right here. Send /stop anytime to turn them off.');
    return ok();
  }

  // /stop — disconnect this chat.
  if (text.startsWith('/stop')) {
    await db.from('telegram_links').delete().eq('chat_id', chatId);
    await sendToChat(db, chatId, '🔕 Disconnected. Reconnect anytime from Field → <b>You → Connect Telegram</b>.');
    return ok();
  }

  await sendToChat(db, chatId, 'Commands: <b>/start</b> &lt;code&gt; to connect, <b>/stop</b> to disconnect. Get your code from Field → You → Connect Telegram.');
  return ok();
});
