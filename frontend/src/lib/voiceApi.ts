import { supabase, functionsBase } from './supabase';

const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface VoiceAccess {
  trialsUsed: number;
  trialsLeft: number;
  subActive: boolean;
  subExpiresAt: string | null;
  priceUsdc: number;
  treasury: string | null;
}

async function req<T>(method: string, path = '', body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const res = await fetch(`${functionsBase}/voice-session${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((out as { error?: string }).error ?? `Request failed (${res.status})`) as Error & { status?: number; data?: unknown };
    err.status = res.status;
    err.data = out;
    throw err;
  }
  return out as T;
}

export const voiceApi = {
  status: () => req<VoiceAccess>('GET'),
  mint: () => req<{ token: string } & VoiceAccess>('POST'),
  subscribe: (txSig: string) => req<{ ok: boolean; subExpiresAt: string }>('POST', '/subscribe', { txSig }),
};
