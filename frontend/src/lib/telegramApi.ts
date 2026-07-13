import { supabase, functionsBase } from './supabase';

const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function req<T>(method: string, path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const res = await fetch(`${functionsBase}/telegram${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `Request failed (${res.status})`);
  return out as T;
}

export interface TelegramStatus {
  connected: boolean;
  tg_username: string | null;
}
export interface TelegramLink {
  code: string;
  url: string;
  bot: string;
  expiresAt: string;
}

export const telegramApi = {
  status: () => req<TelegramStatus>('GET', ''),
  link: () => req<TelegramLink>('POST', '/link'),
  unlink: () => req<{ ok: boolean; connected: boolean }>('POST', '/unlink'),
};
