import { useState } from 'react';
import type { Match, LineupPlayer, TeamLineup } from '../../types';
import { Flag } from '../../components/Flag';
import { StatLabel } from '../../components/StatLabel';

function Pips({ p }: { p: LineupPlayer }) {
  if (!p.goals && !p.yellow && !p.red) return null;
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
      {p.goals > 0 && (
        <span className="tabular text-[11px] font-bold text-grass" title={`${p.goals} goal${p.goals > 1 ? 's' : ''}`}>
          ⚽{p.goals > 1 ? p.goals : ''}
        </span>
      )}
      {p.yellow > 0 && <span className="inline-block h-3 w-[9px] rounded-[2px]" style={{ background: '#ffd21e' }} aria-label="yellow card" />}
      {p.red > 0 && <span className="inline-block h-3 w-[9px] rounded-[2px]" style={{ background: '#ff3b30' }} aria-label="red card" />}
    </span>
  );
}

function PlayerRow({ p }: { p: LineupPlayer }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <span className="tabular w-6 shrink-0 text-right text-xs font-semibold text-muted">{p.number || '–'}</span>
      <span className="min-w-0 truncate text-sm text-chalk-dim">{p.name}</span>
      <Pips p={p} />
    </li>
  );
}

function TeamColumn({ team, code, country }: { team: TeamLineup; code: string; country?: string }) {
  const [showBench, setShowBench] = useState(false);
  const starters = team.players.filter((p) => p.starter);
  const bench = team.players.filter((p) => !p.starter);
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center gap-2">
        <Flag country={country} code={code} size={18} />
        <span className="truncate text-sm font-bold text-chalk">{team.team || code}</span>
      </div>
      <ul className="min-w-0">
        {(starters.length ? starters : team.players).map((p) => (
          <PlayerRow key={p.id} p={p} />
        ))}
      </ul>
      {bench.length > 0 && (
        <>
          <button
            onClick={() => setShowBench((v) => !v)}
            className="mt-2 text-xs font-semibold text-grass hover:underline"
          >
            {showBench ? 'Hide bench' : `Bench (${bench.length})`}
          </button>
          {showBench && (
            <ul className="mt-1 min-w-0 border-t border-edge pt-1">
              {bench.map((p) => (
                <PlayerRow key={p.id} p={p} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function LineupsPanel({ match }: { match: Match }) {
  const lineups = match.lineups;
  const hasPlayers = !!lineups && (lineups.home.players.length > 0 || lineups.away.players.length > 0);

  return (
    <div className="rounded-card border border-edge bg-turf p-4">
      <div className="mb-3 flex items-center justify-between">
        <StatLabel>Lineups</StatLabel>
        {hasPlayers && <span className="eyebrow">Starting XI</span>}
      </div>
      {hasPlayers ? (
        <div className="flex gap-4">
          <TeamColumn team={lineups!.home} code={match.home.code} country={match.home.country} />
          <div className="w-px shrink-0 bg-edge" aria-hidden />
          <TeamColumn team={lineups!.away} code={match.away.code} country={match.away.country} />
        </div>
      ) : (
        <p className="text-sm text-muted">
          {match.status === 'upcoming'
            ? 'Lineups are published at kick-off.'
            : 'Waiting for the feed to publish lineups…'}
        </p>
      )}
    </div>
  );
}
