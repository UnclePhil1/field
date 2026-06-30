import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../app/AppStore';
import { useAuth } from '../app/AuthStore';
import { Chip } from './Chip';
import { CoinIcon, FlameIcon, WalletIcon } from './Icons';
import { formatCoins } from '../lib/format';
import { shortAddress } from '../lib/wallet';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      className={['inline-flex items-baseline font-extrabold tracking-tightest text-chalk', className].join(' ')}
      aria-label="Field — home"
    >
      <span>Field</span>
      <span className="text-grass">.</span>
    </Link>
  );
}

export function CoinsChip() {
  const { coins } = useAppStore();
  return (
    <Chip tone="grass" mono icon={<CoinIcon size={14} />}>
      {formatCoins(coins)}
    </Chip>
  );
}

export function StreakChip() {
  const { streak } = useAppStore();
  return (
    <Chip tone="flare" mono icon={<FlameIcon size={14} />}>
      {streak}
    </Chip>
  );
}

export function WalletChip() {
  const navigate = useNavigate();
  const { wallet, username, signOut } = useAuth();
  if (!wallet) return null;

  async function handleSignOut() {
    await signOut();
    navigate('/connect', { replace: true });
  }

  return (
    <button
      onClick={handleSignOut}
      title="Disconnect wallet"
      className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-turf-2 px-2.5 py-1 text-xs font-semibold text-chalk-dim transition-colors hover:border-grass/60 hover:text-chalk"
    >
      <WalletIcon size={14} />
      <span className="tabular">{username ? `@${username}` : shortAddress(wallet)}</span>
    </button>
  );
}

export function AppBar({ showBrand = true }: { showBrand?: boolean }) {
  return (
    <header className="sticky top-0 z-30 bg-pitch/85 backdrop-blur-md border-b border-edge">
      <div className="flex h-14 items-center justify-between px-4">
        {showBrand ? <Wordmark className="text-xl lg:hidden" /> : <span />}
        <div className="ml-auto flex items-center gap-2">
          <StreakChip />
          <CoinsChip />
          <WalletChip />
        </div>
      </div>
    </header>
  );
}
