import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { fetchMatches } from '../../lib/api';
import { telegramApi } from '../../lib/telegramApi';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { PlayIcon } from '../../components/Icons';
import type { Match } from '../../types';

// "Live Matches" entry. If a match is live, go straight into it. Otherwise show
// an empty state with a way to watch a replay and to turn on Telegram alerts.
export function Live() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [tgConnected, setTgConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetchMatches().then(setMatches).catch(() => setMatches([]));
    telegramApi.status().then((s) => setTgConnected(s.connected)).catch(() => setTgConnected(true));
  }, []);

  if (matches === null) {
    return (
      <div className="mx-auto w-full max-w-play px-4 py-5">
        <div className="h-64 animate-pulse rounded-card border border-edge bg-turf" />
      </div>
    );
  }

  const live = matches.filter((m) => m.status === 'live');
  if (live.length > 0) return <Navigate to={`/match/${live[0].id}`} replace />;

  return (
    <div className="mx-auto w-full max-w-play px-4 py-5">
      <section className="relative corner-arcs overflow-hidden rounded-card-lg border border-edge-2 bg-turf p-8 text-center shadow-card">
        <span className="arc-b" aria-hidden />
        <StatLabel>Live Matches</StatLabel>
        <h1 className="mt-2 text-2xl font-extrabold tracking-display text-chalk">No live match yet</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Nothing is kicking off right now. Rewatch a past match, or get a ping the moment the next one goes live.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button variant="grass" size="md" leftIcon={<PlayIcon size={16} />} onClick={() => navigate('/replay')}>
            Watch a replay
          </Button>
          {tgConnected === false && (
            <Button variant="turf" size="md" onClick={() => navigate('/you')}>
              Get Notified
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
