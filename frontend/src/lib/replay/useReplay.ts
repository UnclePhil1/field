import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchEvent, MatchPhase, Side, StatKind } from '../../types';

export interface ReplayEvent {
  minute: number;
  kind: StatKind;
  side: Side;
  code: string;
  red?: boolean;
}

export interface ReplayState {
  minute: number;
  phase: MatchPhase;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  playing: boolean;
  finished: boolean;
  progress: number; // 0..1
  speed: number;
  play: () => void;
  pause: () => void;
  restart: () => void;
  setSpeed: (n: number) => void;
}

function spotFor(kind: StatKind, side: Side): { x: number; y: number } {
  const r = Math.random();
  if (kind === 'goal') return { x: side === 'home' ? 0.96 : 0.04, y: 0.42 + r * 0.16 };
  if (kind === 'corner') return { x: side === 'home' ? 0.97 : 0.03, y: r > 0.5 ? 0.08 : 0.92 };
  return { x: side === 'home' ? 0.18 + r * 0.22 : 0.6 + r * 0.22, y: 0.2 + r * 0.6 };
}

function phaseForMinute(m: number): MatchPhase {
  if (m <= 0) return 'PRE';
  if (m < 45) return '1H';
  if (m < 46) return 'HT';
  if (m <= 90) return '2H';
  return 'FT';
}

/** Steps a scripted match timeline on an accelerated clock, feeding the Pitch. */
export function useReplay(timeline: ReplayEvent[]): ReplayState {
  const sorted = useMemo(() => [...timeline].sort((a, b) => a.minute - b.minute), [timeline]);
  const [minute, setMinute] = useState(0);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const emitted = useRef(0);
  const seq = useRef(0);
  const timer = useRef<number | null>(null);

  const homeScore = events.filter((e) => e.kind === 'goal' && e.side === 'home').length;
  const awayScore = events.filter((e) => e.kind === 'goal' && e.side === 'away').length;
  const finished = minute >= 90;
  const progress = Math.min(1, minute / 90);

  const stop = () => {
    if (timer.current != null) { clearInterval(timer.current); timer.current = null; }
  };

  // advance the clock; emit events as their minute is reached
  useEffect(() => {
    if (!playing) { stop(); return; }
    timer.current = window.setInterval(() => {
      setMinute((m) => {
        const next = m + 1;
        // emit all events at this minute
        while (emitted.current < sorted.length && sorted[emitted.current].minute <= next) {
          const ev = sorted[emitted.current++];
          const spot = spotFor(ev.kind, ev.side);
          const label = ev.kind === 'goal' ? `Goal · ${ev.code}` : ev.kind === 'corner' ? `Corner · ${ev.code}` : `${ev.red ? 'Red card' : 'Booking'} · ${ev.code}`;
          setEvents((list) => [{ id: `r-${seq.current++}`, matchId: 'replay', kind: ev.kind, side: ev.side, minute: next, label, x: spot.x, y: spot.y }, ...list].slice(0, 8));
        }
        if (next >= 90) { setPlaying(false); return 90; }
        return next;
      });
    }, Math.max(120, 1000 / speed));
    return stop;
  }, [playing, speed, sorted]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const restart = useCallback(() => {
    stop();
    emitted.current = 0;
    seq.current = 0;
    setEvents([]);
    setMinute(0);
    setPlaying(true);
  }, []);

  return {
    minute,
    phase: phaseForMinute(minute),
    homeScore,
    awayScore,
    events,
    playing,
    finished,
    progress,
    speed,
    play,
    pause,
    restart,
    setSpeed,
  };
}
