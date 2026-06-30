import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tournamentApi, type TournamentFilter } from '../../lib/tournamentApi';
import { fetchMatches } from '../../lib/api';
import { TournamentCard } from '../../features/tournament/TournamentCard';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { PlusIcon } from '../../components/Icons';
import type { Tournament } from '../../types/tournament';
import type { Match } from '../../types';

const TABS: { key: TournamentFilter; label: string }[] = [
  { key: 'joinable', label: 'Joinable' },
  { key: 'live', label: 'Live' },
  { key: 'completed', label: 'Completed' },
];

export function Tournaments() {
  const [tab, setTab] = useState<TournamentFilter>('joinable');
  const [items, setItems] = useState<Tournament[] | null>(null);
  const [matches, setMatches] = useState<Record<string, Match>>({});

  useEffect(() => {
    fetchMatches()
      .then((ms) => setMatches(Object.fromEntries(ms.map((m) => [m.id, m]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setItems(null);
    tournamentApi.list(tab).then(setItems).catch(() => setItems([]));
  }, [tab]);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-5">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <StatLabel>Prediction battles</StatLabel>
          <h1 className="mt-1 text-2xl font-extrabold tracking-display text-chalk">Tournaments</h1>
          <p className="mt-1 text-sm text-muted">Free to enter. Climb the board. Top players split a real USDC prize.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/tournaments/mine" className="hidden text-sm font-semibold text-chalk-dim hover:text-chalk sm:block">
            My tournaments
          </Link>
          <Link to="/tournaments/create" className="hidden sm:block">
            <Button variant="grass" leftIcon={<PlusIcon size={18} />}>Create</Button>
          </Link>
        </div>
      </header>

      {/* tabs */}
      <div className="mb-4 flex gap-1 rounded-full border border-edge bg-turf p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'flex-1 rounded-full py-2 text-sm font-semibold transition-colors',
              tab === t.key ? 'bg-grass/15 text-grass' : 'text-muted hover:text-chalk',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <Grid>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-card border border-edge bg-turf" />
          ))}
        </Grid>
      ) : items.length === 0 ? (
        <div className="rounded-card border border-edge bg-turf p-10 text-center">
          <p className="text-base font-semibold text-chalk-dim">No tournaments here yet.</p>
          <p className="mt-1 text-sm text-muted">Be the first to host a prediction battle.</p>
          <Link to="/tournaments/create" className="mt-4 inline-block">
            <Button variant="grass" leftIcon={<PlusIcon size={18} />}>Create tournament</Button>
          </Link>
        </div>
      ) : (
        <Grid>
          {items.map((t) => (
            <TournamentCard key={t.id} tournament={t} match={matches[t.matchId]} />
          ))}
        </Grid>
      )}

      {/* mobile create */}
      <Link to="/tournaments/create" className="mt-5 block sm:hidden">
        <Button variant="grass" fullWidth leftIcon={<PlusIcon size={18} />}>Create tournament</Button>
      </Link>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
