// The single data boundary. Everything now resolves from Supabase (Postgres +
// Realtime). Components and hooks import from here, never from the DB directly,
// so the data source stays contained to this file. No mock data.

import { supabase } from './supabase';
import type {
  Match,
  MatchEvent,
  PredictionCard,
  Player,
  SettledCall,
  Receipt,
} from '../types';

/* ----------------------------- row → type maps ---------------------------- */

type MatchRow = {
  id: string;
  competition: string;
  home_code: string;
  home_name: string;
  home_country: string | null;
  away_code: string;
  away_name: string;
  away_country: string | null;
  status: Match['status'];
  phase: Match['phase'];
  minute: number;
  home_score: number;
  away_score: number;
  home_yellow: number | null;
  home_red: number | null;
  away_yellow: number | null;
  away_red: number | null;
  kickoff: string | null;
};

function toMatch(r: MatchRow): Match {
  return {
    id: r.id,
    competition: r.competition,
    home: { code: r.home_code, name: r.home_name, country: r.home_country ?? undefined },
    away: { code: r.away_code, name: r.away_name, country: r.away_country ?? undefined },
    status: r.status,
    phase: r.phase,
    minute: r.minute,
    homeScore: r.home_score,
    awayScore: r.away_score,
    homeYellow: r.home_yellow ?? 0,
    homeRed: r.home_red ?? 0,
    awayYellow: r.away_yellow ?? 0,
    awayRed: r.away_red ?? 0,
    kickoff: r.kickoff ?? new Date().toISOString(),
  };
}

type EventRow = {
  id: string;
  match_id: string;
  kind: MatchEvent['kind'];
  side: MatchEvent['side'];
  minute: number;
  label: string;
  x: number;
  y: number;
};

function toEvent(r: EventRow): MatchEvent {
  return { id: r.id, matchId: r.match_id, kind: r.kind, side: r.side, minute: r.minute, label: r.label, x: r.x, y: r.y };
}

type CardRow = {
  id: string;
  match_id: string;
  status: PredictionCard['status'];
  stat: PredictionCard['stat'];
  side: PredictionCard['side'];
  question: string;
  subject_team: string;
  multiplier: number;
  locks_at: string;
  window_seconds: number;
  crowd_yes: number;
  sync_line: string | null;
  outcome: PredictionCard['outcome'] | null;
  resolved_stat_label: string | null;
  receipt: Receipt | null;
};

function toCard(r: CardRow): PredictionCard {
  return {
    id: r.id,
    matchId: r.match_id,
    status: r.status,
    stat: r.stat,
    side: r.side,
    question: r.question,
    subjectTeam: r.subject_team,
    multiplier: r.multiplier,
    locksAt: new Date(r.locks_at).getTime(),
    windowSeconds: r.window_seconds,
    crowdYes: r.crowd_yes,
    syncLine: r.sync_line ?? undefined,
    outcome: r.outcome ?? undefined,
    resolvedStatLabel: r.resolved_stat_label ?? undefined,
    receipt: r.receipt ?? undefined,
  };
}

/* ------------------------------- fetchers -------------------------------- */

export async function fetchMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('status', { ascending: true })
    .order('kickoff', { ascending: true });
  if (error) throw error;
  return (data as MatchRow[]).map(toMatch);
}

export async function fetchMatch(id: string): Promise<Match | undefined> {
  const { data } = await supabase.from('matches').select('*').eq('id', id).maybeSingle();
  return data ? toMatch(data as MatchRow) : undefined;
}

export async function fetchLeaderboard(): Promise<Player[]> {
  const { data, error } = await supabase.from('leaderboard').select('*').limit(50);
  if (error) throw error;
  const { data: me } = await supabase.auth.getUser();
  return (data as { id: string; name: string; handle: string; streak: number; points: number }[]).map((p) => ({
    ...p,
    isMe: me.user ? p.id === me.user.id : false,
  }));
}

export async function fetchRecentCalls(): Promise<SettledCall[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select('id, question, result, points, minute, receipt')
    .order('created_at', { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data as { id: string; question: string; result: SettledCall['result']; points: number; minute: number; receipt: Receipt }[]).map(
    (r) => ({ id: r.id, question: r.question, result: r.result, points: r.points, minute: r.minute, receipt: r.receipt }),
  );
}

/* --------------------------- live subscription --------------------------- */

export interface FeedSnapshot {
  match: Match;
  events: MatchEvent[];
  card: PredictionCard | null;
}
type Listener = (snap: FeedSnapshot) => void;

/**
 * Subscribe to a live match. Assembles {match, events, card} from Postgres and
 * pushes a fresh snapshot whenever any of those tables change via Realtime.
 * Same contract the mock emitter used — components are untouched.
 */
export function subscribeMatch(matchId: string, listener: Listener): () => void {
  let cancelled = false;

  async function reload() {
    const [{ data: m }, { data: ev }, { data: cd }] = await Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).maybeSingle(),
      supabase.from('match_events').select('*').eq('match_id', matchId).order('seq', { ascending: false }).limit(8),
      supabase.from('prediction_cards').select('*').eq('match_id', matchId).order('created_at', { ascending: false }).limit(1),
    ]);
    if (cancelled || !m) return;
    listener({
      match: toMatch(m as MatchRow),
      events: (ev as EventRow[] | null)?.map(toEvent) ?? [],
      card: cd && cd.length ? toCard(cd[0] as CardRow) : null,
    });
  }

  reload();

  const channel = supabase
    .channel(`room:${matchId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prediction_cards', filter: `match_id=eq.${matchId}` }, reload)
    .subscribe();

  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
}
