import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { squadsApi, type Squad } from '../../lib/squadsApi';
import { useAuth } from '../../app/AuthStore';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { Flag } from '../../components/Flag';

// Public invite page. A friend lands here from a shared squad link.
export function SquadJoin() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const signedIn = status === 'ready';
  const [squad, setSquad] = useState<Squad | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setSquad(await squadsApi.get(code)); } catch { setSquad(null); }
  }, [code]);
  useEffect(() => { load(); }, [load]);

  async function join() {
    setBusy(true);
    try {
      const s = await squadsApi.join(code);
      navigate(`/match/${s.matchId}`);
    } catch { setBusy(false); }
  }

  if (squad === undefined) return <div className="mx-auto max-w-[560px] px-4 py-8 text-muted">Loading…</div>;
  if (squad === null) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-10 text-center">
        <h1 className="text-xl font-extrabold text-chalk">Squad not found</h1>
        <p className="mt-2 text-sm text-muted">This invite link is invalid or expired.</p>
        <Link to="/play" className="mt-4 inline-block text-sm font-semibold text-grass hover:underline">Go to matches →</Link>
      </div>
    );
  }

  const m = squad.match;

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-6">
      <section className="relative corner-arcs overflow-hidden rounded-card-lg border border-edge-2 bg-turf p-6 shadow-card">
        <span className="arc-b" aria-hidden />
        <StatLabel>Squad invite</StatLabel>
        <h1 className="mt-2 text-2xl font-extrabold tracking-display text-chalk">{squad.name}</h1>
        <p className="mt-1 text-sm text-muted">
          You’ve been invited to play a match together. Everyone’s calls land on one leaderboard — top your friends.
        </p>

        {m && (
          <div className="mt-4 flex items-center justify-center gap-3 rounded-card border border-edge bg-turf-2 p-3">
            <span className="flex items-center gap-1.5 text-sm font-bold text-chalk"><Flag country={m.home_country ?? undefined} code={m.home_code} size={20} />{m.home_code}</span>
            <span className="text-xs text-muted">v</span>
            <span className="flex items-center gap-1.5 text-sm font-bold text-chalk">{m.away_code}<Flag country={m.away_country ?? undefined} code={m.away_code} size={20} /></span>
          </div>
        )}

        {squad.joined ? (
          <>
            <ul className="mt-4 flex flex-col gap-1">
              {squad.standings.map((s) => (
                <li key={s.userId} className={['flex items-center gap-2 rounded-[10px] px-2 py-1.5', s.isMe ? 'bg-grass/[0.08]' : ''].join(' ')}>
                  <span className="tabular w-5 text-xs font-bold text-muted">{s.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">{s.isMe ? 'You' : s.name}</span>
                  <span className="tabular text-sm font-bold text-grass">{s.points}</span>
                </li>
              ))}
            </ul>
            <Button variant="grass" size="lg" fullWidth className="mt-4" onClick={() => navigate(`/match/${squad.matchId}`)}>
              Open the match room
            </Button>
          </>
        ) : signedIn ? (
          <Button variant="grass" size="lg" fullWidth className="mt-5" disabled={busy} onClick={join}>
            {busy ? 'Joining…' : 'Join this squad'}
          </Button>
        ) : (
          <>
            <Link to="/connect"><Button variant="grass" size="lg" fullWidth className="mt-5">Sign in to join</Button></Link>
            <p className="mt-2 text-center text-[11px] text-muted">Free to play — no wallet needed to start.</p>
          </>
        )}
      </section>
    </div>
  );
}
