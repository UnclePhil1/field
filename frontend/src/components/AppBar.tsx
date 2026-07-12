import { Link, useNavigate } from 'react-router-dom';
import { useDisconnect } from '@reown/appkit/react';
import { useAppStore } from '../app/AppStore';
import { useAuth } from '../app/AuthStore';
import { Chip } from './Chip';
import { CoinIcon, FlameIcon, WalletIcon } from './Icons';
import { NotificationBell } from './NotificationBell';
import { formatCoins } from '../lib/format';
import { shortAddress } from '../lib/wallet';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/play"
      className={['inline-flex items-center gap-1.5 font-extrabold tracking-tightest text-chalk', className].join(' ')}
      aria-label="Field — home"
    >
      {/* <Logo size={32} /> */}
      <span className="inline-flex items-baseline">
        <span>Field</span>
        <span className="text-grass">.</span>
      </span>
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
  const { disconnect } = useDisconnect();
  if (!wallet && !username) return null;

  async function handleSignOut() {
    await signOut();
    try {
      await disconnect();
    } catch {
      /* best-effort */
    }
    navigate('/', { replace: true });
  }

  const label = username ? username : wallet ? shortAddress(wallet) : 'Account';
  return (
    <button
      onClick={handleSignOut}
      title={`${label} · sign out`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-edge bg-turf-2 px-2 text-xs font-semibold text-chalk-dim transition-colors hover:border-grass/60 hover:text-chalk sm:px-2.5"
    >
      <WalletIcon size={15} />
      {/* label hidden on mobile — icon only to save space */}
      <span className="tabular hidden max-w-[110px] truncate sm:inline">{label}</span>
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
          <NotificationBell />
          <WalletChip />
        </div>
      </div>
    </header>
  );
}
