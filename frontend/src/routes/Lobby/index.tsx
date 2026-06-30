import { useEffect, useState } from 'react';
import { fetchMatches } from '../../lib/api';
import { MatchCard } from '../../features/match/MatchCard';
import { StatLabel } from '../../components/StatLabel';
import type { Match } from '../../types';

export function Lobby() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches().then((m) => {
      setMatches(m);
      setLoading(false);
    });
  }, []);

  // Only live + upcoming ever show; finished/voided games drop off the lobby.
  const live = matches.filter((m) => m.status === 'live');
  const upcoming = matches.filter((m) => m.status === 'upcoming');

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-5">
      <header className="mb-5">
        <StatLabel>Play along</StatLabel>
        <h1 className="mt-1 text-2xl font-extrabold tracking-display text-chalk">
          Pick a match. Call the next moment.
        </h1>
        <p className="mt-1 text-sm text-muted">
          Free coins, real streaks, every result provably fair.
        </p>
      </header>

      {loading ? (
        <Grid>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-card border border-edge bg-turf" />
          ))}
        </Grid>
      ) : (
        <>
          {live.length > 0 && (
            <section className="mb-6">
              <h2 className="eyebrow mb-2 text-flare-2">Live now</h2>
              <Grid>
                {live.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </Grid>
            </section>
          )}

          <section>
            <h2 className="eyebrow mb-2">Upcoming</h2>
            <Grid>
              {upcoming.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </Grid>
          </section>
        </>
      )}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
