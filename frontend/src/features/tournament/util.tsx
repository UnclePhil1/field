import type { Tournament, TournamentStatus } from '../../types/tournament';
import { Chip } from '../../components/Chip';

export function formatPrize(prize: Tournament['prize']): string {
  return `$${prize.total.toLocaleString('en-US')} ${prize.asset}`;
}

export function shortWallet(w: string, lead = 4, tail = 4): string {
  if (!w) return '';
  if (w.length <= lead + tail) return w;
  return `${w.slice(0, lead)}…${w.slice(-tail)}`;
}

// Cluster for explorer links — keep in sync with the backend SOLANA_CLUSTER.
const SOLANA_CLUSTER = (import.meta.env.VITE_SOLANA_CLUSTER as string) ?? 'mainnet-beta';
export function explorerTx(txSig: string, cluster = SOLANA_CLUSTER): string {
  const qs = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${txSig}${qs}`;
}

const STATUS_META: Record<TournamentStatus, { label: string; tone: 'grass' | 'flare' | 'muted' | 'turf' }> = {
  upcoming: { label: 'Joinable', tone: 'grass' },
  live: { label: 'Live', tone: 'flare' },
  settling: { label: 'Settling', tone: 'turf' },
  awaiting_payout: { label: 'Payout', tone: 'grass' },
  completed: { label: 'Completed', tone: 'muted' },
  voided: { label: 'Voided', tone: 'muted' },
};

export function StatusPill({ status }: { status: TournamentStatus }) {
  const m = STATUS_META[status];
  return (
    <Chip tone={m.tone} className="uppercase">
      {status === 'live' && <span className="animate-live-pulse mr-1 inline-block h-1.5 w-1.5 rounded-full bg-flare" />}
      {m.label}
    </Chip>
  );
}

/** Countdown string for a 48h payout deadline; flags overdue. */
export function payoutCountdown(deadlineIso?: string): { text: string; overdue: boolean } {
  if (!deadlineIso) return { text: '', overdue: false };
  const diff = new Date(deadlineIso).getTime() - Date.now();
  if (diff <= 0) return { text: 'overdue', overdue: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { text: h >= 1 ? `${h}h ${m}m left` : `${m}m left`, overdue: false };
}

export type TournamentAction = 'join' | 'open-room' | 'closed-view' | 'full' | 'submit-address' | 'results';

export function actionFor(t: Tournament, joined: boolean, isWinnerAwaitingAddress: boolean): TournamentAction {
  if (t.status === 'awaiting_payout') return isWinnerAwaitingAddress ? 'submit-address' : 'results';
  if (t.status === 'completed' || t.status === 'voided' || t.status === 'settling') return 'results';
  if (t.status === 'live') return joined ? 'open-room' : 'closed-view';
  if (joined) return 'open-room';
  if (t.capacity.type === 'slots' && t.participantCount >= t.capacity.max) return 'full';
  return 'join';
}
