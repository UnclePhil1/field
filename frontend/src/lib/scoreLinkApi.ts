// Score Link client — the exact-scoreline market.
import { supabase, functionsBase } from './supabase';

const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const res = await fetch(`${functionsBase}/score-link${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `Request failed (${res.status})`);
  return out as T;
}

export interface Scoreline {
  homeGoals: number;
  awayGoals: number;
  multiplier: number;
  entryCents: number;
  tag: string;
}
export interface MyPick extends Scoreline {
  stake: number;
  settled: boolean;
  won: boolean | null;
  payout: number;
}

export const scoreLinkApi = {
  board: (matchId: string) => req<{ scorelines: Scoreline[]; mine: MyPick[]; coins: number }>('GET', `?matchId=${encodeURIComponent(matchId)}`),
  pick: (matchId: string, homeGoals: number, awayGoals: number, stake: number) =>
    req<{ ok: boolean; multiplier: number; entryCents: number; payoutIfWin: number }>('POST', '', { matchId, homeGoals, awayGoals, stake }),
};

/** A shareable Score Link that unfurls as a card + opens a download page. */
export function buildScoreUrl(p: { home: string; away: string; hs: number; as: number; mult: number; tag: string }): string {
  const q = new URLSearchParams({
    home: p.home, away: p.away, hs: String(p.hs), as: String(p.as), mult: String(p.mult), tag: p.tag,
  });
  return `${window.location.origin}/score?${q.toString()}`;
}
