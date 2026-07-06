import { Link } from 'react-router-dom';
import type { Match } from '../../types';
import { Chip } from '../../components/Chip';
import { Flag } from '../../components/Flag';
import { ArrowIcon } from '../../components/Icons';
import { phaseLabel, untilKickoff } from '../../lib/format';

export function MatchCard({ match }: { match: Match }) {
  const live = match.status === 'live';

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

  return (
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
    </Wrapper>
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
