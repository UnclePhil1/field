import type { Match, MatchEvent, Team } from '../../types';
import { Pitch } from '../../components/Pitch';
import { Flag } from '../../components/Flag';
import { MomentumMeter } from './MomentumMeter';
import { EventTicker } from './EventTicker';
import { phaseLabel } from '../../lib/format';

interface LivePanelProps {
  match: Match;
  events: MatchEvent[];
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-flare/40 bg-flare/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-flare-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-live-pulse absolute inline-flex h-full w-full rounded-full bg-flare" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-flare" />
      </span>
      Live
    </span>
  );
}

export function LivePanel({ match, events }: LivePanelProps) {
  return (
    <section className="relative corner-arcs rounded-card-lg border border-edge-2 bg-turf p-4 shadow-card sm:p-5">
      <span className="arc-b" aria-hidden />

      {/* header row */}
      <div className="flex items-center justify-between">
        <LivePill />
        <span className="tabular text-sm text-chalk-dim">
          {phaseLabel(match.phase)} · <span aria-live="polite">{match.minute}'</span>
        </span>
      </div>

      {/* compact score */}
      <div className="mt-3 flex items-center justify-center gap-3 sm:gap-4" aria-live="polite">
        <TeamScore
          team={match.home}
          score={match.homeScore}
          yellow={match.homeYellow ?? 0}
          red={match.homeRed ?? 0}
          align="right"
        />
        <span className="tabular text-sm text-muted">–</span>
        <TeamScore
          team={match.away}
          score={match.awayScore}
          yellow={match.awayYellow ?? 0}
          red={match.awayRed ?? 0}
          align="left"
        />
      </div>
      <p className="mt-1 text-center text-xs text-muted">{match.competition}</p>

      {/* pitch */}
      <div className="mt-4">
        <Pitch events={events} />
      </div>

      <MomentumMeter home={match.home} away={match.away} events={events} />
      <EventTicker events={events} />
    </section>
  );
}

function TeamScore({
  team,
  score,
  yellow,
  red,
  align,
}: {
  team: Team;
  score: number;
  yellow: number;
  red: number;
  align: 'left' | 'right';
}) {
  const right = align === 'right';
  return (
    <div className={['flex min-w-0 items-center gap-2 sm:gap-2.5', right ? 'flex-row' : 'flex-row-reverse'].join(' ')}>
      <Flag country={team.country} code={team.code} size={26} />
      <div className={['min-w-0', right ? 'text-right' : 'text-left'].join(' ')}>
        {/* full name on >=sm, 3-letter code on mobile to stay responsive */}
        <span className="hidden max-w-[90px] truncate text-sm font-bold text-chalk-dim sm:inline-block sm:max-w-[140px]">
          {team.name}
        </span>
        <span className="text-sm font-bold tracking-wide text-chalk-dim sm:hidden">{team.code}</span>
        {(yellow > 0 || red > 0) && (
          <div className={['mt-1 flex items-center gap-1.5', right ? 'justify-end' : 'justify-start'].join(' ')}>
            {yellow > 0 && <CardPip count={yellow} tone="yellow" />}
            {red > 0 && <CardPip count={red} tone="red" />}
          </div>
        )}
      </div>
      <span className="tabular text-3xl font-extrabold leading-none text-chalk">{score}</span>
    </div>
  );
}

/** A small booking-card chip: a coloured card glyph + count. */
function CardPip({ count, tone }: { count: number; tone: 'yellow' | 'red' }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${count} ${tone} card${count > 1 ? 's' : ''}`}>
      <span
        className="inline-block h-3 w-[9px] rounded-[2px] border border-black/30"
        style={{ background: tone === 'yellow' ? '#ffd21e' : '#ff3b30' }}
        aria-hidden
      />
      <span className="tabular text-xs font-bold text-chalk-dim">{count}</span>
    </span>
  );
}
