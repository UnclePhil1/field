import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tournamentApi } from '../../lib/tournamentApi';
import { fetchMatches } from '../../lib/api';
import { TournamentCard } from '../../features/tournament/TournamentCard';
import { StatLabel } from '../../components/StatLabel';
import type { Tournament } from '../../types/tournament';
import type { Match } from '../../types';

export function MyTournaments() {
  const [data, setData] = useState<{ hosting: Tournament[]; joined: Tournament[] } | null>(null);
  const [matches, setMatches] = useState<Record<string, Match>>({});

  useEffect(() => {
    tournamentApi.mine().then(setData).catch(() => setData({ hosting: [], joined: [] }));
    fetchMatches().then((ms) => setMatches(Object.fromEntries(ms.map((m) => [m.id, m])))).catch(() => {});
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-5">
      <StatLabel>My tournaments</StatLabel>
      <h1 className="mt-1 text-2xl font-extrabold tracking-display text-chalk">Hosting & joined</h1>

      <section className="mt-5">
        <h2 className="eyebrow mb-2">Hosting</h2>
        {data?.hosting.length ? (
          <Grid>{data.hosting.map((t) => <TournamentCard key={t.id} tournament={t} match={matches[t.matchId]} />)}</Grid>
        ) : (
          <p className="text-sm text-muted">You're not hosting any tournaments. <Link to="/tournaments/create" className="text-grass hover:underline">Create one →</Link></p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="eyebrow mb-2">Joined</h2>
        {data?.joined.length ? (
          <Grid>{data.joined.map((t) => <TournamentCard key={t.id} tournament={t} match={matches[t.matchId]} />)}</Grid>
        ) : (
          <p className="text-sm text-muted">You haven't joined any tournaments yet. <Link to="/tournaments" className="text-grass hover:underline">Browse battles →</Link></p>
        )}
      </section>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
