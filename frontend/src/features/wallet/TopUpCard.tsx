import { useAppStore } from '../../app/AppStore';
import { StatLabel } from '../../components/StatLabel';
import { CoinIcon } from '../../components/Icons';

export function TopUpCard() {
  const { coins } = useAppStore();
  const low = coins < 100;
  return (
    <section className={['rounded-card border p-4', low ? 'border-flare/40 bg-flare/[0.06]' : 'border-edge bg-turf'].join(' ')}>
      <div className="flex items-center justify-between gap-2">
        <StatLabel>{low ? 'Low on coins' : 'Top up coins'}</StatLabel>
        {low && (
          <span className="tabular rounded-full border border-flare/40 bg-flare/10 px-2 py-0.5 text-[10px] font-bold text-flare-2">
            {coins} left
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-chalk-dim">
        Running low? Top up <span className="font-bold text-chalk">1,000 coins for $3</span>, paid in USDC or SOL.
      </p>
      <p className="mt-0.5 text-xs text-muted">Keep playing Flash Pools and Score Link without waiting for your daily refill.</p>
      <button
        disabled
        title="Coming soon"
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[13px] border border-edge-2 bg-turf-2 py-2.5 text-sm font-bold text-chalk-dim opacity-70"
      >
        <CoinIcon size={15} className="text-grass" /> Topup - soon
      </button>
    </section>
  );
}
