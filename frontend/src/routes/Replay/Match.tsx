import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMatch, fetchMatchEvents } from '../../lib/api';
import { ReplayPlayer } from '../../features/replay/ReplayPlayer';
import type { ReplayEvent } from '../../lib/replay/useReplay';
import type { Match } from '../../types';

const DEMO: { home: string; away: string; timeline: ReplayEvent[] } = {
  home: 'ENG',
  away: 'FRA',
  timeline: [
    { minute: 6, kind: 'corner', side: 'home', code: 'ENG' },
    { minute: 12, kind: 'goal', side: 'home', code: 'ENG' },
    { minute: 23, kind: 'card', side: 'away', code: 'FRA' },
    { minute: 41, kind: 'goal', side: 'away', code: 'FRA' },
    { minute: 58, kind: 'card', side: 'home', code: 'ENG' },
    { minute: 67, kind: 'goal', side: 'home', code: 'ENG' },
    { minute: 74, kind: 'card', side: 'away', code: 'FRA', red: true },
    { minute: 86, kind: 'corner', side: 'home', code: 'ENG' },
    { minute: 90, kind: 'goal', side: 'home', code: 'ENG' },
  ],
};

export function ReplayMatch() {
  const { id = '' } = useParams();
  const [match, setMatch] = useState<Match | null | undefined>(undefined);
  const [timeline, setTimeline] = useState<ReplayEvent[]>([]);

  useEffect(() => {
    if (id === 'demo') {
      setMatch(null);
      setTimeline(DEMO.timeline);
      return;
    }
    (async () => {
      const [m, events] = await Promise.all([fetchMatch(id), fetchMatchEvents(id)]);
      setMatch(m ?? null);
      if (m) {
        setTimeline(
          events.map((e) => ({
            minute: e.minute,
            kind: e.kind,
            side: e.side,
            code: e.side === 'home' ? m.home.code : m.away.code,
            red: /red/i.test(e.label),
          })),
        );
      }
    })();
  }, [id]);

  if (match === undefined) return <div className="mx-auto max-w-play px-4 py-8 text-muted">Loading…</div>;

  const home = match ? match.home : { code: DEMO.home, name: 'England', country: 'gb-eng' };
  const away = match ? match.away : { code: DEMO.away, name: 'France', country: 'fr' };

  const goalHome = timeline.filter((e) => e.kind === 'goal' && e.side === 'home').length;
  const goalAway = timeline.filter((e) => e.kind === 'goal' && e.side === 'away').length;
  const replayable = !match || (goalHome === match.homeScore && goalAway === match.awayScore);

  return (
    <div className="mx-auto w-full max-w-play px-4 py-4 sm:py-5">
      <Link to="/replay" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-chalk">← All replays</Link>
      {match && !replayable ? (
        <p className="rounded-card border border-edge bg-turf p-6 text-center text-sm text-muted">
          No available replay for this match — it wasn’t fully recorded live.
        </p>
      ) : (
        <ReplayPlayer
          home={home}
          away={away}
          competition={match?.competition ?? 'World Cup'}
          stage={match?.stage}
          timeline={timeline}
        />
      )}
    </div>
  );
}
