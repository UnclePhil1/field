import { useCallback, useEffect, useState } from 'react';
import { matchPredictApi, type MatchPrediction } from '../../lib/matchPredictApi';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { Flag } from '../../components/Flag';
import type { Match } from '../../types';

export function CallScoreCard({ match }: { match: Match }) {
  const upcoming = match.status === 'upcoming';
  const [mine, setMine] = useState<MatchPrediction | null>(null);
  const [fanWar, setFanWar] = useState({ home: 0, away: 0 });
  const [hg, setHg] = useState(1);
  const [ag, setAg] = useState(1);
  const [side, setSide] = useState<'home' | 'away' | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await matchPredictApi.get(match.id);
      setFanWar(r.fanWar);
      if (r.mine) {
        setMine(r.mine);
        setHg(r.mine.homeGoals); setAg(r.mine.awayGoals); setSide(r.mine.side);
      }
    } catch { /* ignore */ } finally { setLoaded(true); }
  }, [match.id]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!side) { setErr('Pick a side to back'); return; }
    setBusy(true); setErr(null);
    try {
      await matchPredictApi.submit(match.id, hg, ag, side);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save your call');
    } finally { setBusy(false); }
  }

  const total = fanWar.home + fanWar.away;

  if (!loaded) {
    return upcoming ? <div className="h-40 animate-pulse rounded-card border border-edge bg-turf" /> : null;
  }
  if (!upcoming && !mine && total === 0) return null;
  const homePct = total ? Math.round((fanWar.home / total) * 100) : 50;

  return (
    <section className="rounded-card border border-edge bg-turf p-4">
      <StatLabel>Call the Score</StatLabel>
      <p className="mt-1 text-xs text-muted">
        Predict the final score before kickoff. Exact score pays big; the right winner still pays.
      </p>

      {upcoming ? (
        <>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Stepper code={match.home.code} country={match.home.country} value={hg} onChange={setHg} />
            <span className="text-lg font-extrabold text-muted">–</span>
            <Stepper code={match.away.code} country={match.away.country} value={ag} onChange={setAg} />
          </div>

          <p className="mt-4 text-center text-xs font-semibold text-chalk-dim">Who’s winning it?</p>
          <div className="mt-2 flex gap-2">
            <SideBtn active={side === 'home'} onClick={() => setSide('home')}>Back {match.home.code}</SideBtn>
            <SideBtn active={side === 'away'} onClick={() => setSide('away')}>Back {match.away.code}</SideBtn>
          </div>

          {err && <p className="mt-2 text-xs text-flare-2">{err}</p>}
          <Button variant="grass" size="md" fullWidth className="mt-3" disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : mine ? 'Update my call' : 'Lock in my call'}
          </Button>
          {mine && <p className="mt-1 text-center text-[11px] text-muted">You can change this until kickoff.</p>}
        </>
      ) : (
        <div className="mt-3 rounded-card border border-edge-2 bg-turf-2 p-3 text-center">
          {mine ? (
            <>
              <p className="tabular text-sm font-bold text-chalk">
                Your call: {mine.homeGoals}–{mine.awayGoals}, backing {mine.side === 'home' ? match.home.code : match.away.code}
              </p>
              {mine.settled && (
                <p className={['mt-1 text-xs font-semibold', mine.points > 0 ? 'text-grass' : 'text-muted'].join(' ')}>
                  {mine.points > 0 ? `Nice call — +${mine.points} coins` : 'No points this time'}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">Score calls closed at kickoff.</p>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
            <span className="text-grass">{match.home.code} {homePct}%</span>
            <span className="eyebrow">Fan War</span>
            <span className="text-flare-2">{100 - homePct}% {match.away.code}</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-pitch-deep">
            <div className="h-full bg-grass" style={{ width: `${homePct}%` }} />
            <div className="h-full bg-flare-2" style={{ width: `${100 - homePct}%` }} />
          </div>
          <p className="mt-1 text-center text-[11px] text-muted">{total} fan{total === 1 ? '' : 's'} have picked a side</p>
        </div>
      )}
    </section>
  );
}

function Stepper({ code, country, value, onChange }: { code: string; country?: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="flex items-center gap-1.5 text-xs font-bold text-chalk-dim"><Flag country={country} code={code} size={18} />{code}</span>
      <div className="flex items-center gap-2">
        <StepBtn onClick={() => onChange(Math.max(0, value - 1))}>−</StepBtn>
        <span className="tabular w-6 text-center text-2xl font-extrabold text-chalk">{value}</span>
        <StepBtn onClick={() => onChange(Math.min(20, value + 1))}>+</StepBtn>
      </div>
    </div>
  );
}
function StepBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="grid h-7 w-7 place-items-center rounded-full border border-edge-2 bg-turf-2 text-base font-bold text-chalk-dim hover:border-grass/60 hover:text-chalk">
      {children}
    </button>
  );
}
function SideBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={[
      'flex-1 rounded-[12px] border px-3 py-2 text-sm font-semibold transition-colors',
      active ? 'border-grass bg-grass/10 text-grass' : 'border-edge-2 bg-turf-2 text-chalk-dim hover:text-chalk',
    ].join(' ')}>{children}</button>
  );
}
