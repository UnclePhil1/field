import { FlameIcon } from '../../components/Icons';
import { formatMultiplier } from '../../lib/format';

interface StreakMeterProps {
  streak: number;
  multiplier: number;
  /** rungs to display */
  rungs?: number;
}

export function StreakMeter({ streak, multiplier, rungs = 8 }: StreakMeterProps) {
  return (
    <div>
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <FlameIcon size={26} className="text-flare" />
          <span className="tabular text-4xl font-extrabold leading-none text-chalk">{streak}</span>
          <span className="text-sm font-semibold text-muted">in a row</span>
        </div>
        <span className="tabular rounded-full border border-flare/30 bg-flare/10 px-2.5 py-1 text-xs font-bold text-flare-2">
          {formatMultiplier(multiplier)} bonus
        </span>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {Array.from({ length: rungs }).map((_, i) => (
          <span
            key={i}
            className={[
              'h-2 flex-1 rounded-full transition-colors',
              i < streak ? 'bg-flare' : 'bg-turf-2',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}
