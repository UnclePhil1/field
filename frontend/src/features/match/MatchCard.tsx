import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '../../types';
import { Chip } from '../../components/Chip';
import { Flag } from '../../components/Flag';
import { ArrowIcon } from '../../components/Icons';
import { phaseLabel, untilKickoff } from '../../lib/format';
import { matchPredictApi } from '../../lib/matchPredictApi';
import { BottomSheet } from '../../components/BottomSheet';
import { ScoreLinkDrawer } from '../scorelink/ScoreLinkDrawer';

export function MatchCard({ match }: { match: Match }) {
  const live = match.status === 'live';
  const [fanWar, setFanWar] = useState<{ home: number; away: number } | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);

  // Teaser: how the crowd is leaning (from Call the Score side-picks). Best-effort.
  useEffect(() => {
    let on = true;
    matchPredictApi.get(match.id)
      .then((r) => { if (on) setFanWar(r.fanWar); })
      .catch(() => {});
    return () => { on = false; };
  }, [match.id]);

  const fwTotal = fanWar ? fanWar.home + fanWar.away : 0;
  const fwHomePct = fwTotal ? Math.round((fanWar!.home / fwTotal) * 100) : 50;

  // Only live matches are playable/clickable. Upcoming matches render as a
  // static card so users can't enter a room that hasn't kicked off
  const baseClass =
    'group relative corner-arcs block rounded-card border border-edge bg-turf p-4 transition-colors';
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    live ? (
      <Link
        to={`/match/${match.id}`}
        className={`${baseClass} hover:border-edge-2 focus-visible:border-grass/60`}
      >
        {children}
      </Link>
    ) : (
      <div className={`${baseClass} cursor-default opacity-80`} aria-disabled="true">
        {children}
      </div>
    );

  const card = (
    <Wrapper>
      <span className="arc-b" aria-hidden />
      <div className="flex items-center justify-between">
        <span className="eyebrow">{match.stage ? `${match.competition} · ${match.stage}` : match.competition}</span>
        {live ? (
          <Chip tone="flare" className="uppercase">
            <span className="animate-live-pulse mr-1 inline-block h-1.5 w-1.5 rounded-full bg-flare" />
            Live
          </Chip>
        ) : (
          <Chip tone="muted" mono>
            {untilKickoff(match.kickoff)}
          </Chip>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <TeamRow code={match.home.code} name={match.home.name} country={match.home.country} score={live ? match.homeScore : undefined} />
        <TeamRow code={match.away.code} name={match.away.name} country={match.away.country} score={live ? match.awayScore : undefined} reverse />
      </div>

      {fwTotal > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide">
            <span className="text-grass">{match.home.code} {fwHomePct}%</span>
            <span className="text-muted">Fan War</span>
            <span className="text-flare-2">{100 - fwHomePct}% {match.away.code}</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-pitch-deep">
            <div className="h-full bg-grass" style={{ width: `${fwHomePct}%` }} />
            <div className="h-full bg-flare-2" style={{ width: `${100 - fwHomePct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-edge pt-3">
        <span className="tabular text-xs text-muted">
          {live ? `${phaseLabel(match.phase)} · ${match.minute}'` : 'Kicks off soon'}
        </span>
        {live ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-grass">
            Play now
            <ArrowIcon size={15} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        ) : (
          <span className="text-xs font-semibold text-muted">Not started</span>
        )}
      </div>

      {!live && (
        <button
          onClick={() => setScoreOpen(true)}
          className="mt-3 w-full rounded-[12px] border border-grass/40 bg-grass/10 py-2 text-xs font-bold text-grass transition-colors hover:bg-grass/15"
        >
          Score Link — pick the scoreline
        </button>
      )}
    </Wrapper>
  );

  return (
    <>
      {card}
      {scoreOpen && (
        <BottomSheet open onClose={() => setScoreOpen(false)} title="Score Link">
          <ScoreLinkDrawer match={match} onClose={() => setScoreOpen(false)} />
        </BottomSheet>
      )}
    </>
  );
}

function TeamRow({
  code,
  name,
  country,
  score,
  reverse,
}: {
  code: string;
  name: string;
  country?: string;
  score?: number;
  reverse?: boolean;
}) {
  return (
    <div className={['flex items-center gap-3', reverse ? 'flex-row-reverse text-right' : ''].join(' ')}>
      <Flag country={country} code={code} size={28} />
      <div className={reverse ? 'text-right' : ''}>
        <p className="text-sm font-semibold text-chalk">{name}</p>
        {typeof score === 'number' && <p className="tabular text-lg font-extrabold text-chalk">{score}</p>}
      </div>
    </div>
  );
}
