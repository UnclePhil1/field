import { useEffect, useMemo, useState } from 'react';
import type { PredictionCard as Card, PredictionPick, Receipt as ReceiptType } from '../../types';
import { useAppStore } from '../../app/AppStore';
import { useAuth } from '../../app/AuthStore';
import { supabase } from '../../lib/supabase';
import { tournamentApi } from '../../lib/tournamentApi';
import { useCountdown } from '../../lib/useCountdown';
import { CountdownRing } from '../../components/CountdownRing';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { CheckIcon, CrossIcon, FlameIcon, LockIcon } from '../../components/Icons';
import { formatMultiplier, formatPoints } from '../../lib/format';
import { StakeStepper } from './StakeStepper';
import { Receipt } from '../receipt/Receipt';

interface PredictionCardProps {
  card: Card;
  onViewProof: (r: ReceiptType) => void;
  tournament?: { id: string; points: number };
  onTournamentChange?: () => void;
  paused?: boolean;
}

function Question({ text, team }: { text: string; team: string }) {
  const parts = text.split(team);
  return (
    <h3 className="text-[22px] font-extrabold leading-tight tracking-display text-chalk">
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span className="text-grass">{team}</span>}
        </span>
      ))}
    </h3>
  );
}

interface MyResult {
  result: 'win' | 'loss' | 'void';
  payout: number;
  stake: number;
}

export function PredictionCard({ card, onViewProof, tournament, onTournamentChange, paused }: PredictionCardProps) {
  const { coins, multiplier, placeCall } = useAppStore();
  const { userId } = useAuth();
  const balance = tournament ? tournament.points : coins;
  const { remaining, progress } = useCountdown(card.locksAt, card.windowSeconds);

  const [pick, setPick] = useState<PredictionPick | null>(null);
  const [stake, setStake] = useState(100);
  const [committed, setCommitted] = useState<{ pick: PredictionPick; stake: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myResult, setMyResult] = useState<MyResult | null>(null);

  useEffect(() => {
    setPick(null);
    setStake(100);
    setCommitted(null);
    setSubmitting(false);
    setError(null);
    setMyResult(null);
  }, [card.id]);

  useEffect(() => {
    if (card.status !== 'settled' || !committed || myResult) return;
    if (tournament) {
      if (!card.outcome) {
        setMyResult({ result: 'void', payout: 0, stake: committed.stake });
      } else {
        const won = card.outcome === committed.pick;
        setMyResult({ result: won ? 'win' : 'loss', payout: won ? Math.round(committed.stake * card.multiplier) : 0, stake: committed.stake });
      }
      onTournamentChange?.();
      return;
    }
    if (!userId) return;
    let cancelled = false;
    let tries = 0;
    async function load() {
      const { data } = await supabase
        .from('settlements')
        .select('result, payout, stake')
        .eq('card_id', card.id)
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) setMyResult(data as MyResult);
      else if (tries++ < 5) setTimeout(load, 800);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [card.status, card.id, card.outcome, card.multiplier, committed, userId, myResult, tournament, onTournamentChange]);

  const maxStake = useMemo(() => Math.max(100, Math.min(balance, 500)), [balance]);
  const locked = !!committed;
  const isSettled = card.status === 'settled';

  async function lockIn() {
    if (!pick) return;
    setSubmitting(true);
    setError(null);
    try {
      if (tournament) await tournamentApi.predict(tournament.id, { cardId: card.id, pick, stake });
      else await placeCall({ cardId: card.id, pick, stake });
      setCommitted({ pick, stake });
      onTournamentChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not lock your call.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isSettled) {
    return <SettledView card={card} result={myResult} onViewProof={onViewProof} />;
  }

  if (paused && !locked) {
    return (
      <section className="relative corner-arcs rounded-card-lg border border-edge bg-turf p-5 text-center shadow-card">
        <span className="arc-b" aria-hidden />
        <StatLabel>Half-time</StatLabel>
        <p className="mt-2 text-base font-semibold text-chalk-dim">Predictions are paused.</p>
        <p className="mt-1 text-sm text-muted">New cards resume when the second half kicks off.</p>
      </section>
    );
  }

  return (
    <section className="relative corner-arcs rounded-card-lg border border-edge-2 bg-turf p-4 shadow-card sm:p-5">
      <span className="arc-b" aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <div>
          <StatLabel>Prediction · next 5:00 window</StatLabel>
          {card.syncLine && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-flare-2">
              <span className="h-1.5 w-1.5 rounded-full bg-flare animate-live-pulse" />
              {card.syncLine}
            </p>
          )}
        </div>
        <CountdownRing progress={progress} remaining={remaining} />
      </div>

      <div className="mt-3">
        <Question text={card.question} team={card.subjectTeam} />
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Chip tone="grass" mono>pays {formatMultiplier(card.multiplier)}</Chip>
          <span className="text-xs text-muted">
            <span className="tabular text-chalk-dim">{card.crowdYes}%</span> of players say yes
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <PickPill
          side="yes"
          selected={(committed?.pick ?? pick) === 'yes'}
          disabled={locked}
          potential={`${formatPoints(Math.round(stake * card.multiplier))} pts`}
          onClick={() => setPick('yes')}
        />
        <PickPill
          side="no"
          selected={(committed?.pick ?? pick) === 'no'}
          disabled={locked}
          potential={`${formatPoints(stake)} pts`}
          onClick={() => setPick('no')}
        />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <StatLabel>Your stake</StatLabel>
          {tournament ? (
            <span className="tabular text-xs text-muted">{balance.toLocaleString('en-US')} pts left</span>
          ) : (
            <span className="tabular text-xs text-muted">streak bonus {formatMultiplier(multiplier)}</span>
          )}
        </div>
        <StakeStepper value={stake} onChange={setStake} min={100} step={50} max={maxStake} disabled={locked} />
      </div>

      <div className="mt-4">
        {locked ? (
          <div className="flex items-center justify-center gap-2 rounded-[15px] border border-grass/30 bg-grass/10 px-4 py-3.5 text-center text-sm font-bold text-grass">
            <LockIcon size={16} className="shrink-0" /> Call locked — settling when the window closes
          </div>
        ) : (
          <Button
            variant="grass"
            size="lg"
            fullWidth
            leftIcon={<LockIcon size={18} />}
            disabled={!pick || submitting}
            onClick={lockIn}
          >
            {submitting ? 'Locking…' : pick ? 'Lock in my call' : 'Pick Yes or No'}
          </Button>
        )}
        {error && <p className="mt-2 text-center text-xs text-flare-2">{error}</p>}
      </div>
    </section>
  );
}

function PickPill({
  side,
  selected,
  disabled,
  potential,
  onClick,
}: {
  side: PredictionPick;
  selected: boolean;
  disabled?: boolean;
  potential: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'flex flex-col items-center justify-center rounded-[15px] border py-3.5 transition-all',
        'disabled:cursor-default',
        selected
          ? 'border-grass bg-grass text-ink shadow-grass'
          : 'border-edge-2 bg-turf-2 text-chalk hover:border-grass/50 disabled:opacity-60 disabled:hover:border-edge-2',
      ].join(' ')}
    >
      <span className="text-lg font-extrabold uppercase tracking-wide">{side}</span>
      <span className={['tabular mt-0.5 text-xs font-semibold', selected ? 'text-ink/75' : 'text-muted'].join(' ')}>
        {potential}
      </span>
    </button>
  );
}

function SettledView({
  card,
  result,
  onViewProof,
}: {
  card: Card;
  result: MyResult | null;
  onViewProof: (r: ReceiptType) => void;
}) {
  if (!result || result.result === 'void') {
    return (
      <section className="relative corner-arcs rounded-card-lg border border-edge bg-turf p-5 shadow-card">
        <span className="arc-b" aria-hidden />
        <StatLabel>Window closed</StatLabel>
        <p className="mt-2 text-base font-semibold text-chalk-dim">
          {result?.result === 'void' ? 'Voided — your coins were returned.' : 'You sat this one out.'}
        </p>
        <p className="mt-1 text-sm text-muted">{card.resolvedStatLabel}</p>
        {card.receipt && (
          <Receipt receipt={card.receipt} onViewProof={() => card.receipt && onViewProof(card.receipt)} />
        )}
      </section>
    );
  }

  const win = result.result === 'win';
  return (
    <section
      className={[
        'relative corner-arcs animate-win-reveal rounded-card-lg border bg-turf p-5 shadow-card',
        win ? 'border-grass/45' : 'border-edge-2',
      ].join(' ')}
      aria-live="polite"
    >
      <span className="arc-b" aria-hidden />

      <div className="flex items-center gap-3">
        <span
          className={[
            'grid h-11 w-11 place-items-center rounded-full',
            win ? 'bg-grass text-ink' : 'bg-turf-2 text-muted border border-edge-2',
          ].join(' ')}
        >
          {win ? <CheckIcon size={22} /> : <CrossIcon size={20} />}
        </span>
        <div>
          <p className="text-lg font-extrabold tracking-display text-chalk">
            {win ? 'You called it' : 'Not this time'}
          </p>
          <p className="text-sm text-muted">{card.question}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className={['tabular text-2xl font-extrabold', win ? 'text-grass' : 'text-muted'].join(' ')}>
          {win ? `+${result.payout}` : `−${result.stake}`} <span className="text-sm font-semibold">coins</span>
        </div>
        {win ? (
          <Chip tone="flare" icon={<FlameIcon size={13} />} mono>
            streak +1
          </Chip>
        ) : (
          <Chip tone="muted">streak reset</Chip>
        )}
      </div>

      {card.receipt && (
        <Receipt receipt={card.receipt} onViewProof={() => card.receipt && onViewProof(card.receipt)} />
      )}
    </section>
  );
}
