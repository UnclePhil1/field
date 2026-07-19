import { useEffect, useState } from 'react';
import type { Receipt } from '../../types';
import { Modal } from '../../components/Modal';
import { callFunction } from '../../lib/supabase';
import { CheckIcon, ShieldIcon } from '../../components/Icons';

interface ProofModalProps {
  open: boolean;
  onClose: () => void;
  receipt: Receipt | null;
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <div className="flex flex-col items-center">
        <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full border border-grass/40 bg-grass/10 text-xs font-bold text-grass">
          {n}
        </span>
        <span className="mt-1 w-px flex-1 bg-edge last:hidden" aria-hidden />
      </div>
      <div className="pt-0.5">
        <p className="text-sm font-semibold text-chalk">{title}</p>
        <div className="mt-1 text-xs leading-relaxed text-chalk-dim">{children}</div>
      </div>
    </li>
  );
}

export default function ProofModal({ open, onClose, receipt }: ProofModalProps) {
  const [resolved, setResolved] = useState<Receipt | null>(receipt);
  const [loadingProof, setLoadingProof] = useState(false);

  useEffect(() => {
    setResolved(receipt);
    if (!open || !receipt?.cardId) return;
    let cancelled = false;
    setLoadingProof(true);
    callFunction<{ receipt: Receipt }>('txline-proof', { cardId: receipt.cardId })
      .then((res) => {
        if (!cancelled && res.receipt) setResolved((prev) => ({ ...prev!, ...res.receipt }));
      })
      .catch(() => {/* keep the stored receipt */})
      .finally(() => !cancelled && setLoadingProof(false));
    return () => {
      cancelled = true;
    };
  }, [open, receipt]);

  if (!resolved) return null;
  const view = resolved;
  return (
    <Modal open={open} onClose={onClose} labelledBy="proof-title">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldIcon size={18} className="text-grass" />
            <h2 id="proof-title" className="text-lg font-extrabold tracking-display text-chalk">
              How this result was proven
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-muted hover:text-chalk"
            aria-label="Close proof"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-chalk-dim">
          FanField never decides results itself. It settles one verifiable stat, then asks the
          TxODDS oracle to re-check that stat against data anchored on Solana.
        </p>

        {view.question && (
          <div className="mt-4 rounded-[14px] border border-edge-2 bg-turf-2 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">This pool asked</p>
            <p className="mt-0.5 text-sm font-semibold text-chalk">{view.question}</p>
            {view.outcome && (
              <p className="mt-1 text-xs text-chalk-dim">
                Resolved{' '}
                <span className="font-bold text-grass">{view.outcome.toUpperCase()}</span> — {view.statVerified}
              </p>
            )}
          </div>
        )}

        <ol className="mt-5">
          <Step n={1} title="The stat">
            {view.statVerified}. Sourced live from the {view.source}.
          </Step>
          <Step n={2} title="The Merkle root">
            That event sits inside a signed batch whose root is{' '}
            <span className="tabular font-semibold text-chalk">
              {loadingProof ? 'fetching…' : view.merkleRoot}
            </span>
            . The stat&apos;s leaf hashes back to this exact root — change one event and the root changes.
          </Step>
          <Step n={3} title="Re-checked on Solana">
            FanField submits a <span className="font-semibold text-chalk">validate_stat</span> transaction to the
            TxODDS oracle program on {view.anchoredOn}. The program re-runs the Merkle proof against the root it
            published on-chain and confirms the stat is genuine — so the result doesn&apos;t rely on FanField&apos;s word.
            {view.anchorTx ? (
              <>
                {' '}The proof transaction is{' '}
                <span className="tabular font-semibold text-chalk">{view.txRef}</span>.
              </>
            ) : (
              <> {' '}Waiting on the next on-chain batch to anchor this proof.</>
            )}
            {view.explorerUrl && view.anchorTx && (
              <a
                href={view.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-semibold text-grass hover:underline"
              >
                View the proof transaction on Solana Explorer ↗
              </a>
            )}
          </Step>
        </ol>

        <div className="mt-4 flex items-center justify-between rounded-[14px] border border-grass/30 bg-grass/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-grass">
            <CheckIcon size={16} /> {view.anchorTx ? 'Re-checked on-chain' : 'Verified against the chain'}
          </span>
          {view.anchorTx && view.explorerUrl ? (
            <a
              href={view.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-edge-2 bg-turf-2 px-2.5 py-1 text-[11px] font-semibold text-chalk-dim hover:border-grass/50 hover:text-chalk"
            >
              View proof tx ↗
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-edge-2 bg-turf-2 px-2.5 py-1 text-[11px] font-semibold text-chalk-dim">
              Anchoring…
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}
