import { useEffect, useState } from 'react';
import { subscribeMatch } from './api';
import type { Match, MatchEvent, PredictionCard } from '../types';

export interface LiveMatch {
  match: Match | null;
  events: MatchEvent[];
  card: PredictionCard | null;
  ready: boolean;
}

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
