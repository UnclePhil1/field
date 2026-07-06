import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { tournamentApi } from '../../lib/tournamentApi';
import { fetchMatch } from '../../lib/api';
import { useAuth } from '../../app/AuthStore';
import { TournamentStandings } from '../../features/tournament/TournamentStandings';
import { StatusPill, formatPrize, shortWallet, payoutCountdown, explorerTx, actionFor } from '../../features/tournament/util';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Modal } from '../../components/Modal';
import { Flag } from '../../components/Flag';
import { ShareButton } from '../../components/ShareButton';
import { ArrowIcon, CheckIcon, TrophyIcon } from '../../components/Icons';
import { untilKickoff } from '../../lib/format';
import type { Tournament, Standing, Payout } from '../../types/tournament';
import type { Match } from '../../types';

export function TournamentDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { wallet, userId } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [match, setMatch] = useState<Match | undefined>();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [showAddr, setShowAddr] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    const tour = await tournamentApi.getById(id);
    setT(tour);
    if (tour) {
      fetchMatch(tour.matchId).then(setMatch).catch(() => {});
      tournamentApi.getStandings(id).then(setStandings).catch(() => {});
      tournamentApi.getPayouts(id).then(setPayouts).catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!t) return <div className="mx-auto max-w-[900px] px-4 py-8 text-muted">Loading…</div>;

  const joined = standings.some((s) => s.isMe);
  const myPayout = payouts.find((p) => p.isMe);
  const isWinnerAwaitingAddress = myPayout?.status === 'awaiting_address';
  const action = actionFor(t, joined, !!isWinnerAwaitingAddress);
  const canManage = !!userId && userId === t.hostUserId && t.status === 'upcoming';

  async function doJoin() {
    setBusy(true);
    setError(null);
    try {
      await tournamentApi.join(id);
      setShowJoin(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    setError(null);
    try {
      await tournamentApi.remove(id);
      navigate('/tournaments');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
      setDeleting(false);
    }
  }

  const primary = (() => {
    switch (action) {
      case 'join':
        return <Button variant="grass" size="lg" fullWidth onClick={() => setShowJoin(true)}>Join — free</Button>;
      case 'open-room':
        return (
          <Button variant="grass" size="lg" fullWidth leftIcon={<ArrowIcon size={18} />}
            onClick={() => navigate(`/match/${t.matchId}?t=${t.id}`)}>
            Open match room
          </Button>
        );
      case 'full':
        return <Button variant="turf" size="lg" fullWidth disabled>Tournament full</Button>;
      case 'closed-view':
        return <Button variant="turf" size="lg" fullWidth disabled>Joining closed</Button>;
      case 'submit-address':
        return <Button variant="grass" size="lg" fullWidth onClick={() => setShowAddr(true)}>Claim — submit your USDC address</Button>;
      case 'results':
        return <Button variant="turf" size="lg" fullWidth disabled>Results final</Button>;
    }
  })();

  const deadline = payoutCountdown(t.payoutDeadline);

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-5">
      <Link to="/tournaments" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-chalk">
        ← All tournaments
      </Link>

      {/* banner */}
      <div className="relative overflow-hidden rounded-card-lg border border-edge">
        <div className="h-32 w-full bg-turf-2 sm:h-40">
          {t.bannerUrl && <img src={t.bannerUrl} alt="" className="h-full w-full object-cover opacity-90" />}
        </div>
        <div className="absolute left-4 top-4"><StatusPill status={t.status} /></div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* main column */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-extrabold tracking-display text-chalk">{t.title}</h1>
              <ShareButton className="shrink-0" />
            </div>
            <p className="mt-1 text-sm text-muted">{t.description}</p>
            <p className="mt-2 text-xs text-muted">
              Hosted by <span className="tabular font-semibold text-chalk-dim">{shortWallet(t.hostPayoutWallet)}</span>
            </p>
            {canManage && (
              <div className="mt-3 flex gap-2">
                <Button variant="turf" size="sm" onClick={() => navigate(`/tournaments/${id}/edit`)}>Edit</Button>
                <Button variant="turf" size="sm" className="text-flare-2" onClick={() => setShowDelete(true)}>Delete</Button>
              </div>
            )}
          </div>

          {/* match panel */}
          {match && (
            <Link to={`/match/${t.matchId}${joined ? `?t=${t.id}` : ''}`} className="rounded-card border border-edge bg-turf p-4 transition-colors hover:border-edge-2">
              <div className="flex items-center justify-between">
                <span className="eyebrow">{match.competition}</span>
                {match.status === 'live'
                  ? <Chip tone="flare" className="uppercase"><span className="animate-live-pulse mr-1 inline-block h-1.5 w-1.5 rounded-full bg-flare" />Live {match.minute}'</Chip>
                  : <Chip tone="muted" mono>{untilKickoff(match.kickoff)}</Chip>}
              </div>
              <div className="mt-3 flex items-center justify-center gap-4">
                <span className="flex items-center gap-2"><Flag country={match.home.country} code={match.home.code} size={22} /><span className="text-sm font-bold text-chalk-dim">{match.home.code}</span></span>
                <span className="tabular text-2xl font-extrabold text-chalk">{match.homeScore} – {match.awayScore}</span>
                <span className="flex items-center gap-2"><span className="text-sm font-bold text-chalk-dim">{match.away.code}</span><Flag country={match.away.country} code={match.away.code} size={22} /></span>
              </div>
            </Link>
          )}

          {/* standings */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <StatLabel>{t.status === 'upcoming' ? 'Players' : 'Standings'}</StatLabel>
              <span className="text-xs text-muted">{t.participantCount} joined</span>
            </div>
            <TournamentStandings standings={standings} />
          </div>
        </div>

        {/* rail */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-card border border-edge bg-turf p-4">
            {primary}
            {error && <p className="mt-2 text-center text-xs text-flare-2">{error}</p>}
            {action === 'join' && (
              <p className="mt-2 text-center text-xs text-muted">Free · 1,000 points · top {t.winnersCount} split {formatPrize(t.prize)}</p>
            )}
          </div>

          {/* prize split */}
          <div className="rounded-card border border-edge bg-turf p-4">
            <div className="mb-2 flex items-center justify-between">
              <StatLabel>Prize</StatLabel>
              <Chip tone="grass" mono icon={<TrophyIcon size={13} />}>{formatPrize(t.prize)}</Chip>
            </div>
            <ul className="flex flex-col gap-1.5">
              {t.split.map((pct, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-chalk-dim">{ordinal(i + 1)}</span>
                  <span className="tabular font-semibold text-chalk">
                    {pct}% · ${((t.prize.total * pct) / 100).toLocaleString('en-US')}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Host pays winners directly in USDC within 48h of the result. Each payment is verified on Solana — Field never holds funds.
            </p>
          </div>

          {/* payout strip */}
          {payouts.length > 0 && (
            <div className="rounded-card border border-edge bg-turf p-4">
              <div className="mb-2 flex items-center justify-between">
                <StatLabel>Payouts</StatLabel>
                {t.payoutDeadline && (
                  <span className={['text-xs font-semibold', deadline.overdue ? 'text-flare-2' : 'text-muted'].join(' ')}>{deadline.text}</span>
                )}
              </div>
              <ul className="flex flex-col gap-2">
                {payouts.map((p) => (
                  <li key={p.rank} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-chalk-dim">{ordinal(p.rank)} · <span className="tabular">${p.amount}</span></span>
                    <PayoutBadge payout={p} />
                  </li>
                ))}
              </ul>
              {userId === t.hostUserId && (
                <Link to={`/tournaments/${t.id}/payouts`} className="mt-3 block text-center text-xs font-semibold text-grass hover:underline">
                  Host payout dashboard →
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* join confirm */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} labelledBy="join-title">
        <div className="p-5">
          <h2 id="join-title" className="text-lg font-extrabold tracking-display text-chalk">Join this battle</h2>
          <p className="mt-2 text-sm text-chalk-dim">
            <span className="font-semibold text-grass">Free to join.</span> You get{' '}
            <span className="tabular font-semibold text-chalk">1,000 tournament points</span> to predict with — climb the
            board, top {t.winnersCount} split {formatPrize(t.prize)}.
          </p>
          <p className="mt-2 text-xs text-muted">No payment, no wallet, no gas. A wallet is only needed if you win and claim.</p>
          <div className="mt-5 flex gap-2">
            <Button variant="turf" fullWidth onClick={() => setShowJoin(false)} disabled={busy}>Cancel</Button>
            <Button variant="grass" fullWidth onClick={doJoin} disabled={busy}>{busy ? 'Joining…' : 'Join free'}</Button>
          </div>
        </div>
      </Modal>

      {/* delete confirm (host, before kickoff) */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} labelledBy="del-title">
        <div className="p-5">
          <h2 id="del-title" className="text-lg font-extrabold tracking-display text-chalk">Delete this tournament?</h2>
          <p className="mt-2 text-sm text-chalk-dim">
            This removes the battle and any points players have earned in it. It can’t be undone. No prize is owed because the match hasn’t started.
          </p>
          {error && <p className="mt-2 text-xs text-flare-2">{error}</p>}
          <div className="mt-5 flex gap-2">
            <Button variant="turf" fullWidth onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</Button>
            <Button variant="flare" fullWidth onClick={doDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
          </div>
        </div>
      </Modal>

      {/* winner address submit */}
      <AddressModal open={showAddr} onClose={() => setShowAddr(false)} tournamentId={t.id} defaultWallet={wallet ?? ''} amount={myPayout?.amount ?? 0} rank={myPayout?.rank ?? 0} onDone={refresh} />
    </div>
  );
}

function ordinal(n: number): string {
  return ['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `#${n}`;
}

function PayoutBadge({ payout }: { payout: Payout }) {
  if (payout.status === 'paid') {
    const inner = (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-grass"><CheckIcon size={13} /> Paid · verified</span>
    );
    return payout.txSig ? <a href={explorerTx(payout.txSig)} target="_blank" rel="noreferrer" className="hover:underline">{inner}</a> : inner;
  }
  if (payout.status === 'awaiting_payment') return <span className="text-xs font-semibold text-flare-2">Awaiting payment</span>;
  if (payout.status === 'expired') return <span className="text-xs font-semibold text-muted">Expired</span>;
  return <span className="text-xs font-semibold text-muted">Awaiting address</span>;
}

function AddressModal({ open, onClose, tournamentId, defaultWallet, amount, rank, onDone }: {
  open: boolean; onClose: () => void; tournamentId: string; defaultWallet: string; amount: number; rank: number; onDone: () => void;
}) {
  const [addr, setAddr] = useState(defaultWallet);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setAddr(defaultWallet), [defaultWallet, open]);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await tournamentApi.submitAddress(tournamentId, addr.trim());
      onClose();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not submit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="addr-title">
      <div className="p-5">
        <h2 id="addr-title" className="text-lg font-extrabold tracking-display text-chalk">
          You finished #{rank} — claim ${amount} USDC
        </h2>
        <p className="mt-2 text-sm text-muted">Paste a Solana address that can receive USDC. The host pays you directly within 48h.</p>
        <input
          value={addr}
          onChange={(e) => { setAddr(e.target.value); setErr(null); }}
          placeholder="Your Solana USDC address"
          className="tabular mt-4 h-11 w-full rounded-[13px] border border-edge-2 bg-turf-2 px-3 text-sm text-chalk outline-none focus:border-grass/60"
        />
        {err && <p className="mt-2 text-xs text-flare-2">{err}</p>}
        <p className="mt-2 text-[11px] text-muted">⚠️ Submit within the 48h window or the prize is forfeited (nothing is held on your behalf).</p>
        <div className="mt-5 flex gap-2">
          <Button variant="turf" fullWidth onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="grass" fullWidth onClick={submit} disabled={busy || !addr.trim()}>{busy ? 'Submitting…' : 'Submit address'}</Button>
        </div>
      </div>
    </Modal>
  );
}
