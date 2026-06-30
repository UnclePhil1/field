// Tournaments client — the single boundary the UI calls. Talks to the real
// `tournaments` Edge Function (Postgres-backed). No mocks, no chain calls here:
// money/chain logic lives server-side; the host pays directly and Field verifies.
import { supabase, functionsBase } from './supabase';
import type {
  CreateTournamentInput,
  Payout,
  Standing,
  Tournament,
} from '../types/tournament';

const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const res = await fetch(`${functionsBase}/tournaments${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `Request failed (${res.status})`);
  return out as T;
}

export type TournamentFilter = 'joinable' | 'live' | 'completed';

export const tournamentApi = {
  list: (filter?: TournamentFilter) =>
    req<Tournament[]>('GET', filter ? `?filter=${filter}` : ''),
  getById: (id: string) => req<Tournament>('GET', `/${id}`),
  create: (input: CreateTournamentInput) => req<Tournament>('POST', '', input),
  join: (id: string) => req<{ ok: boolean; points: number }>('POST', `/${id}/join`),
  getStandings: (id: string) => req<Standing[]>('GET', `/${id}/standings`),
  getPayouts: (id: string) => req<Payout[]>('GET', `/${id}/payouts`),
  submitAddress: (id: string, wallet: string) =>
    req<{ ok: boolean }>('POST', `/${id}/payouts/me/address`, { wallet }),
  markPaid: (id: string, rank: number, txSig: string) =>
    req<{ ok: boolean; verified: boolean }>('POST', `/${id}/payouts/${rank}/mark-paid`, { txSig }),
  mine: () => req<{ hosting: Tournament[]; joined: Tournament[] }>('GET', '/mine'),
  me: (id: string) => req<{ joined: boolean; points?: number; rank?: number }>('GET', `/${id}/me`),
  predict: (id: string, body: { cardId: string; pick: 'yes' | 'no'; stake: number }) =>
    req<{ ok: boolean }>('POST', `/${id}/predict`, body),
};

