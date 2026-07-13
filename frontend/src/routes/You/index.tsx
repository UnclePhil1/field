import { Suspense, lazy, useEffect, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import { fetchRecentCalls } from '../../lib/api';
import { StreakMeter } from '../../features/streak/StreakMeter';
import { NotificationSettings } from '../../features/notifications/NotificationSettings';
import { ConnectTelegram } from '../../features/notifications/ConnectTelegram';
import { AccountSettings } from '../../features/account/AccountSettings';
import { TopUpCard } from '../../features/wallet/TopUpCard';
import { StatLabel } from '../../components/StatLabel';
import { Wordmark } from '../../components/AppBar';
import { Button } from '../../components/Button';
import { CheckIcon, CoinIcon, CrossIcon, ShareIcon, ShieldIcon } from '../../components/Icons';
import { formatCoins, formatPoints } from '../../lib/format';
import { buildBragUrl } from '../../lib/brag';
import type { Receipt, SettledCall } from '../../types';

const ProofModal = lazy(() => import('../../features/receipt/ProofModal'));

export function You() {
  const { coins, streak, multiplier, recentCalls } = useAppStore();
  const [history, setHistory] = useState<SettledCall[]>([]);
  const [proof, setProof] = useState<Receipt | null>(null);

  useEffect(() => {
    fetchRecentCalls().then(setHistory);
  }, []);

  const calls = recentCalls.length ? recentCalls : history;
  const wins = calls.filter((c) => c.result === 'win').length;
  const hitRate = calls.length ? Math.round((wins / calls.length) * 100) : 0;

  async function shareStreak() {
    const url = buildBragUrl({
      title: `${streak}-match streak on FanField`,
      sub: `${multiplier}× multiplier · ${hitRate}% hit rate`,
      tag: 'Streak',
    });
    const text = `I'm on a ${streak}-match streak on FanField`;
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'FanField', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch { /* cancelled */ }
  }

  return (
    <div className="mx-auto w-full max-w-play px-4 py-5">
      <StatLabel>You</StatLabel>
      <h1 className="mt-1 text-2xl font-extrabold tracking-display text-chalk">Your run this tournament</h1>

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
        <Button variant="turf" size="md" fullWidth className="mt-4" leftIcon={<ShareIcon size={16} />} onClick={shareStreak}>
          Share my streak card
        </Button>
      </section>

      <div className="mt-5 flex flex-col gap-4">
        <TopUpCard />
        <AccountSettings />
        <ConnectTelegram />
        <NotificationSettings />
      </div>

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
                {c.receipt && (
                  <button
                    onClick={() => setProof(c.receipt!)}
                    title="View the Merkle proof"
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-chalk-dim hover:text-grass"
                  >
                    <ShieldIcon size={13} /> Proof
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Suspense fallback={null}>
        <ProofModal open={!!proof} receipt={proof} onClose={() => setProof(null)} />
      </Suspense>
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
