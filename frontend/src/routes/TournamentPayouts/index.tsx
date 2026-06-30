import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { tournamentApi } from '../../lib/tournamentApi';
import { useAuth } from '../../app/AuthStore';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { shortWallet, payoutCountdown, explorerTx, formatPrize } from '../../features/tournament/util';
import { CheckIcon } from '../../components/Icons';
import type { Payout, Tournament } from '../../types/tournament';

/** Host-only dashboard: pay winners off-app, then mark paid with the tx sig. */
export function TournamentPayouts() {
  const { id = '' } = useParams();
  const { userId } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setT(await tournamentApi.getById(id) ?? null);
    setPayouts(await tournamentApi.getPayouts(id));
    setLoaded(true);
  }, [id]);
  useEffect(() => { refresh(); }, [refresh]);

  if (!loaded || !t) return <div className="mx-auto max-w-[680px] px-4 py-8 text-muted">Loading…</div>;
  // Host-only page: anyone else is bounced to the public detail view.
  if (!userId || userId !== t.hostUserId) return <Navigate to={`/tournaments/${id}`} replace />;
  const deadline = payoutCountdown(t.payoutDeadline);

  return (
    <div className="mx-auto w-full max-w-[680px] px-4 py-5">
      <Link to={`/tournaments/${id}`} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-chalk">← {t.title}</Link>
      <div className="flex items-end justify-between">
        <div>
          <StatLabel>Host payouts</StatLabel>
          <h1 className="mt-1 text-2xl font-extrabold tracking-display text-chalk">Pay your winners</h1>
        </div>
        {t.payoutDeadline && (
          <span className={['text-sm font-semibold', deadline.overdue ? 'text-flare-2' : 'text-chalk-dim'].join(' ')}>{deadline.text}</span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        Send {formatPrize(t.prize)} total from your wallet to each winner's address, then paste the transaction signature — Field verifies it on Solana.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {payouts.length === 0 && <p className="text-sm text-muted">No payouts yet — standings aren't final.</p>}
        {payouts.map((p) => (
          <PayoutRow key={p.rank} tournamentId={id} payout={p} onDone={refresh} />
        ))}
      </div>
    </div>
  );
}

function PayoutRow({ tournamentId, payout, onDone }: { tournamentId: string; payout: Payout; onDone: () => void }) {
  const [sig, setSig] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function markPaid() {
    setBusy(true); setErr(null);
    try {
      await tournamentApi.markPaid(tournamentId, payout.rank, sig.trim());
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-edge bg-turf p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-chalk">{['1st', '2nd', '3rd', '4th', '5th'][payout.rank - 1]} · <span className="tabular">${payout.amount} USDC</span></span>
        {payout.status === 'paid' ? (
          <a href={payout.txSig ? explorerTx(payout.txSig) : '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-grass hover:underline">
            <CheckIcon size={13} /> Paid · verified
          </a>
        ) : payout.status === 'awaiting_address' ? (
          <span className="text-xs font-semibold text-muted">Waiting for winner's address</span>
        ) : (
          <span className="text-xs font-semibold text-flare-2">Awaiting your payment</span>
        )}
      </div>

      {payout.winnerWallet && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          Pay to: <span className="tabular text-chalk-dim">{shortWallet(payout.winnerWallet, 6, 6)}</span>
          <button onClick={() => navigator.clipboard?.writeText(payout.winnerWallet!)} className="rounded border border-edge-2 px-1.5 py-0.5 text-[10px] hover:text-chalk">copy</button>
        </p>
      )}

      {payout.status === 'awaiting_payment' && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={sig} onChange={(e) => { setSig(e.target.value); setErr(null); }} placeholder="Payment tx signature" className="tabular h-10 flex-1 rounded-[12px] border border-edge-2 bg-turf-2 px-3 text-sm text-chalk outline-none focus:border-grass/60" />
          <Button variant="grass" onClick={markPaid} disabled={busy || !sig.trim()}>{busy ? 'Verifying…' : 'Mark paid'}</Button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-flare-2">{err}</p>}
    </div>
  );
}
