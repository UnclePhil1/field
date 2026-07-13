import { supabase, functionsBase } from './supabase';

const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const res = await fetch(`${functionsBase}/match-predict${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `Request failed (${res.status})`);
  return out as T;
}

export interface MatchPrediction {
  homeGoals: number;
  awayGoals: number;
  side: 'home' | 'away';
  settled: boolean;
  points: number;
}

export const matchPredictApi = {
  get: (matchId: string) =>
    req<{ mine: MatchPrediction | null; fanWar: { home: number; away: number } }>('GET', `?matchId=${encodeURIComponent(matchId)}`),
  submit: (matchId: string, homeGoals: number, awayGoals: number, side: 'home' | 'away') =>
    req<{ ok: boolean }>('POST', '', { matchId, homeGoals, awayGoals, side }),
};
