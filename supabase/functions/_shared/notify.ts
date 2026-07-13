import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { fcmEnabled, notifyUser } from './fcm.ts';
import { sendTelegram } from './telegram.ts';

export interface InboxPayload {
  title: string;
  body?: string;
  url?: string;
  kind?: string;
}

export async function notifyInbox(db: SupabaseClient, userId: string, n: InboxPayload): Promise<void> {
  await db.from('notifications').insert({
    user_id: userId,
    title: n.title,
    body: n.body ?? '',
    url: n.url ?? null,
    kind: n.kind ?? 'general',
  });
}

export async function notifyAll(db: SupabaseClient, userId: string, n: InboxPayload): Promise<void> {
  await notifyInbox(db, userId, n).catch(() => {});
  if (fcmEnabled) {
    await notifyUser(db, userId, { title: n.title, body: n.body ?? '', url: n.url, tag: n.kind }).catch(() => {});
  }
  await sendTelegram(db, userId, { title: n.title, body: n.body, url: n.url }).catch(() => {});
}
