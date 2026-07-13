import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchEvent, Side } from '../types';
import '../styles/pitch.css';

interface PitchProps {
  events: MatchEvent[];
  homeMomentum?: number;
  formations?: { home: string; away: string };
}

function formationDots(formation: string, side: Side): { x: number; y: number; n: number }[] {
  const lines = formation.split('-').map((n) => parseInt(n, 10)).filter((n) => n > 0);
  const rows = [1, ...lines]; 
  const half = 0.44;
  const dots: { x: number; y: number; n: number }[] = [];
  let num = 1;
  rows.forEach((count, rowIdx) => {
    const t = rows.length === 1 ? 0 : rowIdx / (rows.length - 1); // own goal → halfway
    const xHome = 0.06 + t * half;
    const x = side === 'home' ? xHome : 1 - xHome;
    for (let i = 0; i < count; i++) {
      dots.push({ x, y: (i + 1) / (count + 1), n: num++ });
    }
  });
  return dots;
}

interface Mark {
  id: string;
  x: number;
  y: number;
  side: Side;
  kind: string;
  red: boolean;
}

export function Pitch({ events, homeMomentum, formations = { home: '4-3-3', away: '4-4-2' } }: PitchProps) {
  const last = events[0];

  const dots = useMemo(
    () => [
      ...formationDots(formations.home, 'home').map((d) => ({ ...d, side: 'home' as Side })),
      ...formationDots(formations.away, 'away').map((d) => ({ ...d, side: 'away' as Side })),
    ],
    [formations.home, formations.away],
  );
  const [pulse, setPulse] = useState<{ id: string; x: number; y: number; side: Side; kind: string } | null>(null);
  const [mark, setMark] = useState<Mark | null>(null);
  const seen = useRef<string | null>(null);

  const [goal, setGoal] = useState<{ id: string; side: Side; code: string } | null>(null);
  const goalSeen = useRef<string | null>(null);
  const lastGoal = useMemo(() => events.find((e) => e.kind === 'goal') ?? null, [events]);

  useEffect(() => {
    if (!lastGoal || goalSeen.current === lastGoal.id) return;
    goalSeen.current = lastGoal.id;
    const code = lastGoal.label.split('·')[1]?.trim() ?? '';
    setGoal({ id: lastGoal.id, side: lastGoal.side, code });
    const t = setTimeout(() => setGoal((g) => (g && g.id === lastGoal.id ? null : g)), 3600);
    return () => clearTimeout(t);
  }, [lastGoal]);

  const momentum = useMemo(() => {
    if (typeof homeMomentum === 'number') return homeMomentum;
    const recent = events.slice(0, 5);
    if (recent.length === 0) return 0.5;
    const home = recent.filter((e) => e.side === 'home').length;
    return 0.25 + (home / recent.length) * 0.5;
  }, [events, homeMomentum]);

  useEffect(() => {
    if (!last || seen.current === last.id) return;
    seen.current = last.id;
    setPulse({ id: last.id, x: last.x, y: last.y, side: last.side, kind: last.kind });
    if (last.kind === 'corner' || last.kind === 'card') {
      setMark({
        id: last.id,
        x: last.x,
        y: last.y,
        side: last.side,
        kind: last.kind,
        red: /red/i.test(last.label),
      });
    }
    const t = setTimeout(() => setPulse(null), 1200);
    const t2 = setTimeout(() => setMark((m) => (m && m.id === last.id ? null : m)), 2800);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [last]);

  const heatLeft = `${20 + momentum * 60}%`;
  const threatLeft = last ? `${last.x * 100}%` : '50%';
  const threatTop = last ? `${last.y * 100}%` : '50%';

  return (
    <div className="pitch" aria-hidden>
      <svg className="pitch__lines" viewBox="0 0 320 200" preserveAspectRatio="none">
        <g fill="none" stroke="var(--line)" strokeWidth="1.4">
          <rect x="6" y="6" width="308" height="188" rx="4" />
          <line x1="160" y1="6" x2="160" y2="194" />
          <circle cx="160" cy="100" r="26" />
          <circle cx="160" cy="100" r="2.4" fill="var(--line)" stroke="none" />
          <rect x="6" y="58" width="42" height="84" />
          <rect x="6" y="80" width="16" height="40" />
          <rect x="272" y="58" width="42" height="84" />
          <rect x="298" y="80" width="16" height="40" />
          <path d="M6 16 A10 10 0 0 0 16 6" />
          <path d="M304 6 A10 10 0 0 0 314 16" />
          <path d="M6 184 A10 10 0 0 1 16 194" />
          <path d="M314 184 A10 10 0 0 1 304 194" />
        </g>
      </svg>

      {dots.map((d) => (
        <span
          key={`${d.side}-${d.n}`}
          className={['pitch__player', `pitch__player--${d.side}`].join(' ')}
          style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
        >
          {d.n}
        </span>
      ))}

      <div className="pitch__heat" style={{ left: heatLeft }} />

      {last && last.kind !== 'corner' && (
        <div className="pitch__threat" style={{ left: threatLeft, top: threatTop }} />
      )}

      {pulse && (
        <div
          key={pulse.id}
          className={['pitch__pulse', pulse.kind === 'card' ? 'pitch__pulse--flare' : ''].join(' ')}
          style={{ left: `${pulse.x * 100}%`, top: `${pulse.y * 100}%` }}
        />
      )}

      {mark?.kind === 'corner' && (
        <div className="pitch__corner-glow" style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }} />
      )}
      {mark?.kind === 'corner' && (
        <div
          className={['pitch__corner', mark.y < 0.25 ? 'pitch__corner--low' : ''].join(' ')}
          style={{ left: `${Math.min(85, Math.max(15, mark.x * 100))}%`, top: `${mark.y * 100}%` }}
        >
          <span className="pitch__corner-label">Corner Kick</span>
          <span className="pitch__corner-dot" />
        </div>
      )}

      {mark?.kind === 'card' && (
        <div
          className={['pitch__card', mark.red ? 'pitch__card--red' : 'pitch__card--yellow'].join(' ')}
          style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
        />
      )}

      {goal && (
        <div className="pitch__goal" key={goal.id}>
          <span
            className={[
              'pitch__goal-ball',
              goal.side === 'home' ? 'pitch__goal-ball--right' : 'pitch__goal-ball--left',
            ].join(' ')}
          />
          <div className="pitch__goal-word">
            <span>
              GOAL
              {goal.code && <small>{goal.code}</small>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
