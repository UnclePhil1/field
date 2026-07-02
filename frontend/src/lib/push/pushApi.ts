// Client for the `push` Edge Function (token + preference management).
import { supabase, functionsBase } from '../supabase';

const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface NotificationPreferences {
  enabled: boolean;
  match_events: { goals: boolean; cards: boolean; corners: boolean; phases: boolean };
  my_play: { card_locking: boolean; settled: boolean; streak_risk: boolean; new_card: boolean };
  tournaments: { results: boolean; payout: boolean; paid: boolean };
  followed: string[];
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const res = await fetch(`${functionsBase}/push${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `push ${path} failed`);
  return out as T;
}

export const pushApi = {
  register: (token: string, userAgent: string) => req('POST', '/register', { token, userAgent, platform: 'web' }),
  unregister: (token: string) => req('POST', '/unregister', { token }),
  test: () => req<{ ok: boolean; tokens: number; configured: boolean }>('POST', '/test'),
  getPreferences: () => req<Partial<NotificationPreferences>>('GET', '/preferences'),
  setPreferences: (prefs: Partial<NotificationPreferences>) => req<NotificationPreferences>('PUT', '/preferences', prefs),
};
