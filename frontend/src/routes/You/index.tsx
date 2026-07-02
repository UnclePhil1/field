import { useEffect, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import { fetchRecentCalls } from '../../lib/api';
import { StreakMeter } from '../../features/streak/StreakMeter';
import { NotificationSettings } from '../../features/notifications/NotificationSettings';
import { StatLabel } from '../../components/StatLabel';
import { Wordmark } from '../../components/AppBar';
import { Button } from '../../components/Button';
import { CheckIcon, CoinIcon, CrossIcon, ShareIcon } from '../../components/Icons';
import { formatCoins, formatPoints } from '../../lib/format';
import type { SettledCall } from '../../types';

export function You() {
  const { coins, streak, multiplier, recentCalls } = useAppStore();
  const [history, setHistory] = useState<SettledCall[]>([]);

  useEffect(() => {
    fetchRecentCalls().then(setHistory);
  }, []);

  const calls = recentCalls.length ? recentCalls : history;
  const wins = calls.filter((c) => c.result === 'win').length;
  const hitRate = calls.length ? Math.round((wins / calls.length) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-play px-4 py-5">
      <StatLabel>You</StatLabel>
      <h1 className="mt-1 text-2xl font-extrabold tracking-display text-chalk">Your run this tournament</h1>

      {/* streak card (shareable preview) */}
      <section className="relative corner-arcs mt-4 overflow-hidden rounded-card-lg border border-edge-2 bg-turf p-5 shadow-card">
        <span className="arc-b" aria-hidden />
        <div className="flex items-center justify-between">
          <Wordmark className="text-lg" />
          <span className="eyebrow">streak card</span>
        </div>
        <div className="mt-4">
          <StreakMeter streak={streak} multiplier={multiplier} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-edge pt-4">
          <Stat label="Coins" value={formatCoins(coins)} icon={<CoinIcon size={14} className="text-grass" />} />
          <Stat label="Hit rate" value={`${hitRate}%`} />
          <Stat label="Calls" value={`${calls.length}`} />
        </div>
        <Button variant="turf" size="md" fullWidth className="mt-4" leftIcon={<ShareIcon size={16} />} disabled title="Coming soon">
          Share my streak card — coming soon
        </Button>
      </section>

      {/* notifications */}
      <div className="mt-5">
        <NotificationSettings />
      </div>

      {/* history */}
      <section className="mt-5">
        <StatLabel>Recent history</StatLabel>
        <ul className="mt-3 flex flex-col gap-1.5">
          {calls.slice(0, 8).map((c) => {
            const win = c.result === 'win';
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-[13px] border border-edge bg-turf px-3 py-2.5">
                <span
                  className={['grid h-7 w-7 place-items-center rounded-full', win ? 'bg-grass/15 text-grass' : 'bg-turf-2 text-muted'].join(' ')}
                >
                  {win ? <CheckIcon size={15} /> : <CrossIcon size={14} />}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">{c.question}</p>
                <span className={['tabular text-sm font-bold', win ? 'text-grass' : 'text-muted'].join(' ')}>
                  {formatPoints(c.points)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="tabular mt-1 flex items-center gap-1 text-lg font-extrabold text-chalk">
        {icon}
        {value}
      </p>
    </div>
  );
}
