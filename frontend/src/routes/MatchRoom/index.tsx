import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveMatch } from '../../lib/useLiveMatch';
import { useAppStore } from '../../app/AppStore';
import { tournamentApi } from '../../lib/tournamentApi';
import { TrophyIcon, PlayIcon } from '../../components/Icons';
import { ShareButton } from '../../components/ShareButton';
import { LivePanel } from '../../features/match/LivePanel';
import { RecentCalls } from '../../features/match/RecentCalls';
import { CallScoreCard } from '../../features/match/CallScoreCard';
import { SquadPanel } from '../../features/squad/SquadPanel';
import { PredictionCard } from '../../features/prediction/PredictionCard';
import { LeaderboardTable } from '../../features/board/LeaderboardTable';
import { StatLabel } from '../../components/StatLabel';
import { fetchLeaderboard } from '../../lib/api';
import type { Player, Receipt } from '../../types';

const ProofModal = lazy(() => import('../../features/receipt/ProofModal'));

export function MatchRoom() {
  const { id = 'eng-fra' } = useParams();
  const [params] = useSearchParams();
  const tournamentId = params.get('t');
  const { match, events, card, ready } = useLiveMatch(id);
  const { recentCalls, setActiveMatch } = useAppStore();

  const [proof, setProof] = useState<Receipt | null>(null);
  const [board, setBoard] = useState<Player[]>([]);
  const [tour, setTour] = useState<{ id: string; title: string; points: number; rank?: number } | null>(null);

  useEffect(() => {
    setActiveMatch(id);
    fetchLeaderboard().then(setBoard);
    return () => setActiveMatch(null);
  }, [id, setActiveMatch]);

  const refreshTour = useCallback(async () => {
    if (!tournamentId) {
      setTour(null);
      return;
    }
    const [t, me] = await Promise.all([tournamentApi.getById(tournamentId), tournamentApi.me(tournamentId)]);
    if (t && me.joined) setTour({ id: t.id, title: t.title, points: me.points ?? 0, rank: me.rank });
  }, [tournamentId]);
  useEffect(() => {
    refreshTour();
  }, [refreshTour]);

  if (!ready || !match) {
    return <RoomSkeleton />;
  }

  const thisMatchBoard = topThreePlusMe(board);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-4 sm:py-5">
      {match.status === 'finished' && (
        <Link
          to={`/replay/${match.id}`}
          className="mb-4 flex items-center justify-between gap-3 rounded-card border border-grass/40 bg-grass/10 px-4 py-2.5 transition-colors hover:border-grass/60"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-grass">
            <PlayIcon size={16} className="shrink-0" />
            <span className="truncate">Full time — watch the replay</span>
          </span>
          <span className="shrink-0 text-xs font-bold text-chalk-dim">→</span>
        </Link>
      )}
      {tour && (
        <Link
          to={`/tournaments/${tour.id}`}
          className="mb-4 flex items-center justify-between gap-3 rounded-card border border-grass/40 bg-grass/10 px-4 py-2.5 transition-colors hover:border-grass/60"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-grass">
            <TrophyIcon size={16} className="shrink-0" />
            <span className="truncate">Tournament: {tour.title}</span>
          </span>
          <span className="tabular shrink-0 text-xs font-bold text-chalk-dim">
            {tour.rank ? `rank #${tour.rank} · ` : ''}{tour.points.toLocaleString('en-US')} pts
          </span>
        </Link>
      )}
      <div className="flex flex-col gap-6 xl:flex-row">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-4 xl:max-w-play">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{match.home.name} v {match.away.name}</span>
          <ShareButton label="Share match" />
        </div>
        <LivePanel match={match} events={events} />
        <RecentCalls calls={recentCalls} onViewProof={setProof} />
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[320px]">
        <div className="rounded-card border border-edge bg-turf p-4">
          <div className="mb-3 flex items-center justify-between">
            <StatLabel>This match</StatLabel>
            <Link to="/board" className="text-xs font-semibold text-grass hover:underline">
              Full board
            </Link>
          </div>
          <LeaderboardTable players={thisMatchBoard} compact />
        </div>

        <CallScoreCard match={match} />

        {card && (
          <PredictionCard
            card={card}
            onViewProof={setProof}
            tournament={tour ? { id: tour.id, points: tour.points } : undefined}
            onTournamentChange={refreshTour}
            paused={match.phase === 'HT'}
          />
        )}

        <SquadPanel matchId={match.id} />
      </aside>

      <Suspense fallback={null}>
        <ProofModal open={!!proof} receipt={proof} onClose={() => setProof(null)} />
      </Suspense>
      </div>
    </div>
  );
}

function topThreePlusMe(board: Player[]): Player[] {
  const ranked = board.map((p, i) => ({ ...p, rank: i + 1 }));
  const top3 = ranked.slice(0, 3);
  const me = ranked.find((p) => p.isMe);
  if (me && !top3.some((p) => p.id === me.id)) {
    return [...top3, me];
  }
  return top3;
}

function RoomSkeleton() {
  return (
    <div className="mx-auto w-full max-w-play px-4 py-5">
      <div className="h-64 animate-pulse rounded-card-lg border border-edge bg-turf" />
      <div className="mt-4 h-72 animate-pulse rounded-card-lg border border-edge bg-turf" />
    </div>
  );
}
