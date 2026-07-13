import { supabase, functionsBase } from './supabase';

const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const res = await fetch(`${functionsBase}/squads${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `Request failed (${res.status})`);
  return out as T;
}

export interface SquadStanding {
  userId: string;
  name: string;
  streak: number;
  points: number;
  rank: number;
  isMe: boolean;
}
export interface Squad {
  code: string;
  name: string;
  matchId: string;
  ownerId: string;
  memberCount: number;
  joined: boolean;
  match: {
    id: string; home_code: string; away_code: string; home_name: string; away_name: string;
    home_country: string | null; away_country: string | null; status: string; competition: string;
    stage: string | null; kickoff: string | null;
  } | null;
  standings: SquadStanding[];
}

export const squadsApi = {
  mine: (matchId: string) => req<{ squad: { code: string; name: string } | null }>('GET', `/mine?matchId=${encodeURIComponent(matchId)}`),
  create: (matchId: string) => req<{ code: string; name: string; matchId: string }>('POST', '', { matchId }),
  join: (code: string) => req<{ code: string; name: string; matchId: string }>('POST', `/${code}/join`),
  get: (code: string) => req<Squad>('GET', `/${code}`),
};
