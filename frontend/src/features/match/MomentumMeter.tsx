import type { MatchEvent, Team } from '../../types';

interface MomentumMeterProps {
  home: Team;
  away: Team;
  events: MatchEvent[];
}

/** Split bar driven by recent verifiable events — interpretation, not tracking. */
export function MomentumMeter({ home, away, events }: MomentumMeterProps) {
  const recent = events.slice(0, 6);
  const homeCount = recent.filter((e) => e.side === 'home').length;
  const homePct = recent.length ? Math.round((homeCount / recent.length) * 100) : 50;
  const awayPct = 100 - homePct;

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-chalk-dim">
          <span className="tabular text-grass">{homePct}%</span> {home.code}
        </span>
        <span className="eyebrow">momentum</span>
        <span className="flex items-center gap-1.5 text-chalk-dim">
          {away.code} <span className="tabular">{awayPct}%</span>
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-pitch-deep" role="img" aria-label={`Momentum ${home.code} ${homePct}%, ${away.code} ${awayPct}%`}>
        <div
          className="h-full rounded-l-full bg-grass/80 transition-[width] duration-700"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="h-full rounded-r-full bg-edge-2 transition-[width] duration-700"
          style={{ width: `${awayPct}%` }}
        />
      </div>
    </div>
  );
}
