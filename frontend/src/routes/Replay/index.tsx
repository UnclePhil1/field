import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchReplayLibrary } from '../../lib/api';
import { Flag } from '../../components/Flag';
import { StatLabel } from '../../components/StatLabel';
import { PlayIcon } from '../../components/Icons';
import type { Match } from '../../types';

type Entry = { match: Match; replayable: boolean };

/** Replay library — every finished match, rewatchable, plus a showcase demo. */
export function Replay() {
  const [matches, setMatches] = useState<Entry[] | null>(null);

  useEffect(() => {
    fetchReplayLibrary().then(setMatches).catch(() => setMatches([]));
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-5">
      <Link to="/play" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-chalk">← Matches</Link>
      <StatLabel>Replays</StatLabel>
      <h1 className="mt-1 text-2xl font-extrabold tracking-display text-chalk">Miss a match? Rewatch it.</h1>
      <p className="mt-1 text-sm text-muted">Every finished match replays with its real goals, cards and corners.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {/* showcase demo always available */}
        <ReplayCard to="/replay/demo" title="Showcase" subtitle="England v France · demo" />

        {matches === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-card border border-edge bg-turf" />
            ))
          : matches.map((e) => (
              <MatchReplayCard key={e.match.id} match={e.match} replayable={e.replayable} />
            ))}
      </div>

      {matches !== null && matches.length === 0 && (
        <p className="mt-4 text-sm text-muted">No finished matches yet — once a live match ends it appears here to rewatch.</p>
      )}
    </div>
  );
}

function MatchReplayCard({ match: m, replayable }: { match: Match; replayable: boolean }) {
  const inner = (
    <>
      <span className="arc-b" aria-hidden />
      <div className="flex items-center justify-between">
        <span className="eyebrow">{m.stage ? `${m.competition} · ${m.stage}` : m.competition}</span>
        {replayable && <PlayIcon size={16} className="text-grass" />}
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <span className="flex items-center gap-1.5"><Flag country={m.home.country} code={m.home.code} size={20} /><span className="text-sm font-bold text-chalk-dim">{m.home.code}</span></span>
        <span className="tabular text-xl font-extrabold text-chalk">{m.homeScore}–{m.awayScore}</span>
        <span className="flex items-center gap-1.5"><span className="text-sm font-bold text-chalk-dim">{m.away.code}</span><Flag country={m.away.country} code={m.away.code} size={20} /></span>
      </div>
      <p className={['mt-3 border-t border-edge pt-2 text-center text-xs font-semibold', replayable ? 'text-grass group-hover:underline' : 'text-muted'].join(' ')}>
        {replayable ? 'Watch replay →' : 'No available replay'}
      </p>
    </>
  );

  if (!replayable) {
    return (
      <div className="relative corner-arcs block rounded-card border border-edge bg-turf p-4 opacity-70" aria-disabled>
        {inner}
      </div>
    );
  }
  return (
    <Link to={`/replay/${m.id}`} className="group relative corner-arcs block rounded-card border border-edge bg-turf p-4 transition-colors hover:border-edge-2">
      {inner}
    </Link>
  );
}

function ReplayCard({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <Link to={to} className="group relative corner-arcs flex flex-col justify-between rounded-card border border-grass/30 bg-grass/[0.06] p-4 transition-colors hover:border-grass/60">
      <span className="arc-b" aria-hidden />
      <div className="flex items-center justify-between">
        <span className="eyebrow text-grass">{title}</span>
        <PlayIcon size={16} className="text-grass" />
      </div>
      <p className="mt-3 text-sm font-semibold text-chalk">{subtitle}</p>
      <p className="mt-3 border-t border-grass/20 pt-2 text-center text-xs font-semibold text-grass group-hover:underline">Watch →</p>
    </Link>
  );
}
