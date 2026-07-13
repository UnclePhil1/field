import type { Receipt as ReceiptType, SettledCall } from '../../types';
import { StatLabel } from '../../components/StatLabel';
import { BragButton } from '../../components/BragButton';
import { CheckIcon, CrossIcon } from '../../components/Icons';
import { formatPoints } from '../../lib/format';

interface RecentCallsProps {
  calls: SettledCall[];
  onViewProof: (r: ReceiptType) => void;
}

export function RecentCalls({ calls, onViewProof }: RecentCallsProps) {
  if (calls.length === 0) return null;
  return (
    <section className="rounded-card border border-edge bg-turf p-4">
      <StatLabel>Your recent calls</StatLabel>
      <div className="mt-3 max-h-[19rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
        <ul className="divide-y divide-edge/70">
          {calls.map((c) => {
          const win = c.result === 'win';
          return (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <span
                className={[
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full',
                  win ? 'bg-grass/15 text-grass' : 'bg-turf-2 text-muted',
                ].join(' ')}
              >
                {win ? <CheckIcon size={15} /> : <CrossIcon size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-chalk">{c.question}</p>
                <p className="text-xs text-muted">
                  {win ? 'Verified win' : 'Streak reset'} · <span className="tabular">{c.minute}'</span>
                </p>
              </div>
              <span className={['tabular text-sm font-bold', win ? 'text-grass' : 'text-muted'].join(' ')}>
                {formatPoints(c.points)}
              </span>
              {win && (
                <BragButton
                  title={`Called it: ${c.question}`}
                  sub="Nailed the call on FanField"
                  tag="Called it"
                  label="Brag"
                  className="hidden sm:inline-flex"
                />
              )}
              <button
                onClick={() => onViewProof(c.receipt)}
                className="rounded-full px-2 py-1 text-[11px] font-semibold text-chalk-dim hover:text-grass"
              >
                Proof
              </button>
            </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
