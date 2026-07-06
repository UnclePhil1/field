// Endpoint Telegram calls with bot updates. Users tap a link in the app that
// opens the bot and sends "/start <code>"; we match the code to their account
// and save the chat so alerts can be delivered.
import { admin } from '../_shared/supabase.ts';
import { sendToChat } from '../_shared/telegram.ts';

const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

const WELCOME = [
  '👋 <b>Welcome to FanField</b>',
  '',
  'FanField is a live play-along game for football — predict the next goal, card or corner while the match happens.',
  '',
  'Once your account is connected, this chat gets:',
  '⚽ Goals, cards and corners as they happen',
  '⏰ Kick-off and full-time',
  '🎯 New prediction cards to play',
  '🏆 Tournament results and payouts',
  '',
  'To connect, open <b>fanfield.xyz → You → Connect Telegram</b> and tap the link.',
].join('\n');

function ok(): Response {
  return new Response('ok', { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok();
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

  if (text.startsWith('/start')) {
    const code = text.slice('/start'.length).trim().toUpperCase();
    if (!code) {
      await sendToChat(db, chatId, WELCOME);
      return ok();
    }
    const { data: row } = await db
      .from('telegram_link_codes')
      .select('user_id, expires_at')
      .eq('code', code)
      .maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      await sendToChat(db, chatId, '⏳ That link expired. Open FanField → <b>You → Connect Telegram</b> for a fresh one.');
      return ok();
    }
    // One chat per account and one account per chat — clear any prior owners.
    await db.from('telegram_links').delete().eq('chat_id', chatId);
    await db.from('telegram_links').delete().eq('user_id', row.user_id);
    await db.from('telegram_links').insert({ user_id: row.user_id, chat_id: chatId, tg_username: tgUsername });
    await db.from('telegram_link_codes').delete().eq('code', code);
    await sendToChat(
      db,
      chatId,
      '✅ <b>You’re connected!</b>\n\nYou’ll now get goals, cards, corners, prediction cards and tournament results right here. Send /stop anytime to turn them off.',
    );
    return ok();
  }

  if (text.startsWith('/stop')) {
    await db.from('telegram_links').delete().eq('chat_id', chatId);
    await sendToChat(db, chatId, '🔕 Alerts are off. Reconnect anytime from FanField → <b>You → Connect Telegram</b>.');
    return ok();
  }

  await sendToChat(db, chatId, WELCOME);
  return ok();
});
