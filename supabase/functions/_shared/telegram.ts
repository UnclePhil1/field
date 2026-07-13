import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export const telegramEnabled = !!BOT_TOKEN;

export interface TgPayload {
  title: string;
  body?: string;
  url?: string; // app path ("/match/123") or absolute URL
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function absolute(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return url;
  return APP_URL ? `${APP_URL}${url.startsWith('/') ? '' : '/'}${url}` : undefined;
}

export async function sendToChat(db: SupabaseClient, chatId: string, text: string, url?: string): Promise<boolean> {
  if (!telegramEnabled) return false;
  const link = absolute(url);
  const reply_markup = link ? { inline_keyboard: [[{ text: 'Open Field ⚽', url: link }]] } : undefined;
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup,
    }),
  });
  if (!res.ok) {
    if (res.status === 403 || res.status === 400) {
      await db.from('telegram_links').delete().eq('chat_id', chatId);
    }
    return false;
  }
  return true;
}

export async function sendTelegram(db: SupabaseClient, userId: string, p: TgPayload): Promise<void> {
  if (!telegramEnabled) return;
  const { data: link } = await db.from('telegram_links').select('chat_id').eq('user_id', userId).maybeSingle();
  if (!link) return;
  const text = `<b>${esc(p.title)}</b>${p.body ? `\n${esc(p.body)}` : ''}`;
  await sendToChat(db, String(link.chat_id), text, p.url);
}

export async function broadcastTelegram(db: SupabaseClient, userIds: string[], p: TgPayload): Promise<void> {
  if (!telegramEnabled || userIds.length === 0) return;
  const { data: links } = await db.from('telegram_links').select('chat_id').in('user_id', userIds);
  if (!links?.length) return;
  const text = `<b>${esc(p.title)}</b>${p.body ? `\n${esc(p.body)}` : ''}`;
  await Promise.all(links.map((l) => sendToChat(db, String(l.chat_id), text, p.url).catch(() => false)));
}
