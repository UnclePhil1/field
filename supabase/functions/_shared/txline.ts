import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const DATA_BASE = Deno.env.get('TXLINE_BASE') ?? 'https://txline-dev.txodds.com';
const AUTH_BASE = Deno.env.get('TXLINE_AUTH_BASE') ?? DATA_BASE;
const STATIC_API_TOKEN = Deno.env.get('TXLINE_API_TOKEN') ?? '';

interface Session {
  jwt: string;
  apiToken: string;
}

async function loadCached(db: SupabaseClient): Promise<{ jwt?: string; apiToken?: string; valid: boolean }> {
  const { data } = await db.from('txline_session').select('jwt, api_token, expires_at').eq('id', true).maybeSingle();
  if (!data) return { valid: false };
  const valid = !!data.jwt && !!data.expires_at && new Date(data.expires_at).getTime() > Date.now() + 30_000;
  return { jwt: data.jwt ?? undefined, apiToken: data.api_token ?? undefined, valid };
}

async function storeCached(db: SupabaseClient, jwt: string, apiToken: string, ttlSeconds = 600) {
  await db.from('txline_session').upsert({
    id: true,
    jwt,
    api_token: apiToken,
    expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
}

async function guestStart(): Promise<string> {
  const res = await fetch(`${AUTH_BASE}/auth/guest/start`, { method: 'POST' });
  if (!res.ok) throw new Error(`guest/start ${res.status}`);
  const body = await res.json();
  return body.token ?? body.jwt ?? body.access_token;
}

async function activate(jwt: string): Promise<string> {
  if (STATIC_API_TOKEN) return STATIC_API_TOKEN;
  const res = await fetch(`${DATA_BASE}/api/token/activate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`token/activate ${res.status} — is the devnet subscription set up?`);
  const body = await res.json();
  return body.apiToken ?? body.api_token ?? body.token;
}

export async function getSession(db: SupabaseClient): Promise<Session> {
  const cached = await loadCached(db);
  if (cached.valid && cached.jwt && (cached.apiToken || STATIC_API_TOKEN)) {
    return { jwt: cached.jwt, apiToken: cached.apiToken || STATIC_API_TOKEN };
  }
  const jwt = await guestStart();
  const apiToken = STATIC_API_TOKEN || cached.apiToken || (await activate(jwt));
  await storeCached(db, jwt, apiToken);
  return { jwt, apiToken };
}

function headers(s: Session): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${s.jwt}`,
    'X-Api-Token': s.apiToken,
  };
}

async function get<T>(s: Session, path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}${path}`, { headers: headers(s) });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export interface TxFixture {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  StartTime: number; // epoch ms
  CompetitionId?: number;
  [k: string]: unknown;
}

export function fetchFixtures(s: Session, competitionId?: number): Promise<TxFixture[]> {
  const q = competitionId ? `?competitionId=${competitionId}` : '';
  return get<TxFixture[]>(s, `/api/fixtures/snapshot${q}`);
}

export function fetchScores(s: Session, fixtureId: number): Promise<unknown[]> {
  return get<unknown[]>(s, `/api/scores/snapshot/${fixtureId}`);
}

export function fetchScoresHistorical(s: Session, fixtureId: number): Promise<unknown[]> {
  return get<unknown[]>(s, `/api/scores/historical/${fixtureId}`);
}

export interface OddsOffer {
  SuperOddsType?: string;
  PriceNames?: string[];
  Prices?: number[];
  Pct?: string[]; // implied probability %, 3dp, or "NA"
  InRunning?: boolean;
  MarketPeriod?: string;
  Ts?: number;
}

export function fetchOdds(s: Session, fixtureId: number): Promise<OddsOffer[]> {
  return get<OddsOffer[]>(s, `/api/odds/snapshot/${fixtureId}`);
}

export function fetchStatValidation(
  s: Session,
  fixtureId: number,
  seq: number,
  statKey: number,
): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>(
    s,
    `/api/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKey=${statKey}`,
  );
}
