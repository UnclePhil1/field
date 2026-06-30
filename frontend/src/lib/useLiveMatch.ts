import { useEffect, useState } from 'react';
import { subscribeMatch } from './api';
import type { Match, MatchEvent, PredictionCard } from '../types';

export interface LiveMatch {
  match: Match | null;
  events: MatchEvent[];
  card: PredictionCard | null;
  ready: boolean;
}

/**
 * The one real-time hook. Components only ever see {match, events, card}.
 *
 * subscribeMatch (lib/api) assembles the snapshot from Supabase and pushes a
 * fresh one whenever the match, its events, or its current card change via
 * Supabase Realtime. The hook and every consuming component stay source-agnostic.
 */
export function useLiveMatch(matchId: string): LiveMatch {
  const [state, setState] = useState<LiveMatch>({
    match: null,
    events: [],
    card: null,
    ready: false,
  });

  useEffect(() => {
    setState((s) => ({ ...s, ready: false }));
    const unsub = subscribeMatch(matchId, (snap) => {
      setState({ match: snap.match, events: snap.events, card: snap.card, ready: true });
    });
    return unsub;
  }, [matchId]);

  return state;
}
