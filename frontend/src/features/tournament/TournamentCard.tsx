import { Link } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';
import type { Match } from '../../types';
import { Chip } from '../../components/Chip';
import { CoinIcon, TrophyIcon, YouIcon } from '../../components/Icons';
import { untilKickoff } from '../../lib/format';
import { StatusPill, formatPrize } from './util';

export function TournamentCard({ tournament: t, match }: { tournament: Tournament; match?: Match }) {
  const capacityLabel =
    t.capacity.type === 'slots' ? `${t.participantCount}/${t.capacity.max} slots` : `${t.participantCount} joined`;

  return (
    <Link
      to={`/tournaments/${t.id}`}
      className="group relative corner-arcs flex flex-col overflow-hidden rounded-card border border-edge bg-turf transition-colors hover:border-edge-2 focus-visible:border-grass/60"
    >
      <div className="relative h-24 w-full overflow-hidden bg-turf-2">
        {t.bannerUrl ? (
          <img src={t.bannerUrl} alt="" className="h-full w-full object-cover opacity-90" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-grass/20 to-turf" />
        )}
        <div className="absolute left-3 top-3">
          <StatusPill status={t.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-base font-extrabold tracking-display text-chalk">{t.title}</h3>

        <p className="mt-1 text-xs text-muted">
          {match ? (
            <>
              {match.home.code} v {match.away.code} ·{' '}
              {match.status === 'live' ? (
                <span className="font-semibold text-flare-2">LIVE {match.minute}'</span>
              ) : (
                <span className="tabular">{untilKickoff(match.kickoff)}</span>
              )}
            </>
          ) : (
            'World Cup'
          )}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip tone="grass" mono icon={<TrophyIcon size={13} />}>
            {formatPrize(t.prize)}
          </Chip>
          <Chip tone="turf" icon={<CoinIcon size={13} />}>
            Top {t.winnersCount}
          </Chip>
          <Chip tone="muted" icon={<YouIcon size={13} />}>
            {capacityLabel}
          </Chip>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-edge pt-3">
          <span className="eyebrow">{t.prize.asset} prize</span>
          <span className="text-xs font-semibold text-grass group-hover:underline">
            {t.status === 'upcoming' ? 'Join →' : 'View →'}
          </span>
        </div>
      </div>
    </Link>
  );
}
