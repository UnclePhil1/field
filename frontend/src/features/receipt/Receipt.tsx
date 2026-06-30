import type { Receipt as ReceiptType } from '../../types';
import { CheckIcon, ShieldIcon } from '../../components/Icons';

interface ReceiptProps {
  receipt: ReceiptType;
  onViewProof: () => void;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={['text-xs font-semibold text-chalk-dim', mono ? 'tabular' : ''].join(' ')}>{value}</span>
    </div>
  );
}

export function Receipt({ receipt, onViewProof }: ReceiptProps) {
  return (
    <div className="mt-4 rounded-[14px] border border-edge bg-pitch-deep/60 p-3.5">
      <div className="flex items-center gap-2">
        <ShieldIcon size={15} className="text-grass" />
        <span className="eyebrow text-grass">provably-fair receipt</span>
      </div>
      <div className="mt-2 divide-y divide-edge/60">
        <Row label="Result source" value={receipt.source} />
        <Row label="Stat verified" value={receipt.statVerified} />
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className="text-xs text-muted">Merkle root</span>
          <span className="flex items-center gap-1.5">
            <span className="tabular text-xs font-semibold text-chalk">{receipt.merkleRoot}</span>
            <CheckIcon size={14} className="text-grass" />
          </span>
        </div>
        <Row label="Anchored on" value={receipt.anchoredOn} />
      </div>
      <button
        onClick={onViewProof}
        className="mt-3 w-full rounded-[12px] border border-grass/40 bg-grass/10 py-2.5 text-sm font-bold text-grass transition-colors hover:bg-grass/15"
      >
        View the proof
      </button>
    </div>
  );
}
