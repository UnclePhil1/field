import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../../lib/api';
import { LeaderboardTable } from '../../features/board/LeaderboardTable';
import { StatLabel } from '../../components/StatLabel';
import type { Player } from '../../types';

type Tab = 'match' | 'tournament';

export function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tab, setTab] = useState<Tab>('match');

  useEffect(() => {
    fetchLeaderboard().then(setPlayers);
  }, []);

  // tournament view: same players, weighted differently for variety
  const rows =
    tab === 'match'
      ? players
      : [...players].sort((a, b) => b.streak * 500 + b.points - (a.streak * 500 + a.points));

  return (
    <div className="mx-auto w-full max-w-play px-4 py-5">
      <StatLabel>Leaderboard</StatLabel>
      <h1 className="mt-1 text-2xl font-extrabold tracking-display text-chalk">Who&apos;s reading the game</h1>

      <div className="mt-4 inline-flex rounded-full border border-edge bg-turf p-1" role="tablist" aria-label="Leaderboard scope">
        <TabBtn active={tab === 'match'} onClick={() => setTab('match')}>
          This match
        </TabBtn>
        <TabBtn active={tab === 'tournament'} onClick={() => setTab('tournament')}>
          Tournament
        </TabBtn>
      </div>

      <div className="mt-4">
        <LeaderboardTable players={rows} />
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
        active ? 'bg-grass text-ink' : 'text-chalk-dim hover:text-chalk',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
