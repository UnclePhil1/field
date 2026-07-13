import { useCallback, useEffect, useState } from 'react';
import { scoreLinkApi, type Scoreline, type MyPick } from '../../lib/scoreLinkApi';
import { Button } from '../../components/Button';
import { CoinIcon } from '../../components/Icons';
import type { Match } from '../../types';

type View = { name: 'list' } | { name: 'stake'; line: Scoreline } | { name: 'done'; line: Scoreline; stake: number; mult: number };

function tagClass(tag: string): string {
  if (tag === 'Favored') return 'border-grass/40 bg-grass/10 text-grass';
  if (tag === 'Hot Pick') return 'border-flare/40 bg-flare/10 text-flare';
  return 'border-edge-2 bg-turf-2 text-chalk-dim'; // Moonshot
}

export function ScoreLinkDrawer({ match, onClose }: { match: Match; onClose: () => void }) {
  const [lines, setLines] = useState<Scoreline[] | null>(null);
  const [mine, setMine] = useState<MyPick[]>([]);
  const [coins, setCoins] = useState(0);
  const [view, setView] = useState<View>({ name: 'list' });
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const b = await scoreLinkApi.board(match.id);
      setLines(b.scorelines); setMine(b.mine); setCoins(b.coins);
    } catch { setLines([]); }
  }, [match.id]);
  useEffect(() => { load(); }, [load]);

  const picked = (h: number, a: number) => mine.find((m) => m.homeGoals === h && m.awayGoals === a);

  async function confirm(line: Scoreline) {
    if (stake <= 0 || stake > coins) { setErr('Enter a stake you can afford'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await scoreLinkApi.pick(match.id, line.homeGoals, line.awayGoals, stake);
      setView({ name: 'done', line, stake, mult: r.multiplier });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not place pick');
    } finally { setBusy(false); }
  }

  const header = (
    <div className="mb-3 border-b border-edge pb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-extrabold tracking-display text-chalk">Exact Score</h2>
        <span className="rounded-full border border-grass/40 bg-grass/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-grass">No fees</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-grass">Pick the nastiest scoreline.</p>
      <p className="text-xs text-muted">Lower entry means a bigger payout if the match lands exactly there.</p>
      <p className="mt-2 flex items-center gap-1 text-xs text-chalk-dim"><CoinIcon size={13} className="text-grass" /> {coins.toLocaleString('en-US')} coins to stake</p>

      <div className="mt-3 rounded-card border border-edge-2 bg-turf-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-chalk">Real stake</span>
            <span className="rounded-full border border-flare/40 bg-flare/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-flare-2">Soon</span>
          </div>
          <span role="switch" aria-checked="false" aria-disabled="true" className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-edge-2 bg-turf opacity-60">
            <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-muted" />
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          Play with real funds instead of coins. Your stake locks in a vault for the match. At full time, everyone who called the exact scoreline splits the funds staked on the wrong scorelines. Free play stays free, this is opt-in.
        </p>
      </div>
    </div>
  );

  if (view.name === 'stake' || view.name === 'done') {
    const line = view.line;
    if (view.name === 'done') {
      const img = `/api/og?type=scoreline&home=${match.home.code}&away=${match.away.code}&hs=${line.homeGoals}&as=${line.awayGoals}&mult=${view.mult}&tag=${encodeURIComponent(line.tag)}`;
      return (
        <div>
          {header}
          <div className="rounded-card border border-grass/40 bg-grass/[0.06] p-4 text-center">
            <p className="eyebrow text-grass">Score Link locked</p>
            <p className="tabular mt-1 text-2xl font-extrabold text-chalk">{match.home.code} {line.homeGoals}–{line.awayGoals} {match.away.code}</p>
            <p className="mt-1 text-sm text-chalk-dim">Staked {view.stake} · could win <span className="font-bold text-grass">{Math.round(view.stake * view.mult)}</span> at {view.mult}×</p>
          </div>
          <img src={img} alt="" className="mt-4 w-full rounded-card border border-edge-2" />
          <p className="mt-2 text-center text-[11px] text-muted">This is locked for the match — one Score Link per game.</p>
          <Button variant="grass" size="md" fullWidth className="mt-3" onClick={onClose}>Close</Button>
        </div>
      );
    }
    return (
      <div>
        {header}
        <button onClick={() => setView({ name: 'list' })} className="mb-3 text-xs font-semibold text-muted hover:text-chalk">← Back to board</button>
        <div className="rounded-card border border-edge-2 bg-turf-2 p-4 text-center">
          <span className={['inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', tagClass(line.tag)].join(' ')}>{line.tag}</span>
          <p className="tabular mt-2 text-3xl font-extrabold text-chalk">{match.home.code} {line.homeGoals}–{line.awayGoals} {match.away.code}</p>
          <p className="mt-1 text-xl font-extrabold text-grass">{line.multiplier}×</p>
          <p className="text-xs text-muted">$1 pays ${line.multiplier}</p>
        </div>
        <label className="mt-4 block text-xs font-semibold text-muted">Stake (coins)</label>
        <input type="number" min={1} max={coins} value={stake} onChange={(e) => setStake(Math.floor(Number(e.target.value)))}
          className="tabular mt-1 h-11 w-full rounded-[13px] border border-edge-2 bg-turf-2 px-3 text-sm text-chalk outline-none focus:border-grass/60" />
        <p className="mt-2 text-sm text-chalk-dim">If it lands exactly, you win <span className="font-bold text-grass">{Math.round(stake * line.multiplier).toLocaleString('en-US')}</span> coins.</p>
        {err && <p className="mt-2 text-xs text-flare-2">{err}</p>}
        <Button variant="grass" size="lg" fullWidth className="mt-3" disabled={busy} onClick={() => confirm(line)}>{busy ? 'Placing…' : `Stake ${stake} on ${line.homeGoals}–${line.awayGoals}`}</Button>
      </div>
    );
  }

  const myPick = mine[0];
  if (myPick) {
    const img = `/api/og?type=scoreline&home=${match.home.code}&away=${match.away.code}&hs=${myPick.homeGoals}&as=${myPick.awayGoals}&mult=${myPick.multiplier}&tag=${encodeURIComponent(myPick.tag)}`;
    return (
      <div>
        {header}
        <div className="rounded-card border border-grass/40 bg-grass/[0.06] p-4 text-center">
          <p className="eyebrow text-grass">Your Score Link</p>
          <p className="tabular mt-1 text-2xl font-extrabold text-chalk">{match.home.code} {myPick.homeGoals}–{myPick.awayGoals} {match.away.code}</p>
          {myPick.settled ? (
            <p className={['mt-1 text-sm font-bold', myPick.won ? 'text-grass' : 'text-muted'].join(' ')}>
              {myPick.won ? `Hit! +${myPick.payout} coins` : 'Missed this time'}
            </p>
          ) : (
            <p className="mt-1 text-sm text-chalk-dim">Staked {myPick.stake} · could win <span className="font-bold text-grass">{Math.round(myPick.stake * myPick.multiplier).toLocaleString('en-US')}</span> at {myPick.multiplier}×</p>
          )}
        </div>
        <img src={img} alt="" className="mt-4 w-full rounded-card border border-edge-2" />
        <p className="mt-2 text-center text-[11px] text-muted">One Score Link per match — this can’t be changed.</p>
        <Button variant="grass" size="md" fullWidth className="mt-3" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div>
      {header}
      {lines === null ? (
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-card border border-edge bg-turf" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {lines.map((l) => {
            const mp = picked(l.homeGoals, l.awayGoals);
            return (
              <button
                key={`${l.homeGoals}-${l.awayGoals}`}
                onClick={() => { setErr(null); setStake(Math.min(50, coins || 50)); setView({ name: 'stake', line: l }); }}
                className={['rounded-card border p-3 text-left transition-colors', mp ? 'border-grass bg-grass/[0.06]' : 'border-edge bg-turf hover:border-grass/40'].join(' ')}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={['shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-tight', tagClass(l.tag)].join(' ')}>{l.tag}</span>
                  <span className="tabular whitespace-nowrap text-[9px] leading-none text-muted">{l.entryCents}¢ <span className="text-[8px]">entry</span></span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-muted">
                  <span>{match.home.code}</span><span>{match.away.code}</span>
                </div>
                <div className="tabular flex items-center justify-center gap-3 text-3xl font-extrabold text-chalk">
                  <span>{l.homeGoals}</span><span className="text-muted">-</span><span>{l.awayGoals}</span>
                </div>
                <p className="tabular mt-1 text-center text-lg font-extrabold text-grass">{l.multiplier}×</p>
                <p className="text-center text-[10px] text-muted">{mp ? `staked ${mp.stake}` : `$1 pays $${l.multiplier}`}</p>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-center text-[11px] text-muted">Prices move as fans back teams and stake scorelines.</p>
      <div className="h-2" />
      <Button variant="ghost" size="sm" fullWidth onClick={onClose}>Close</Button>
    </div>
  );
}

