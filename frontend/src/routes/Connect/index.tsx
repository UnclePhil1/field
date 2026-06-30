import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthStore';
import { Button } from '../../components/Button';
import { WalletIcon } from '../../components/Icons';
import { WalletPicker } from '../../components/WalletPicker';
import type { SolanaProvider } from '../../lib/wallet';

/**
 * Wallet sign-up / sign-in screen. Connecting a Solana wallet IS the
 * account: a brand-new wallet is routed to /onboard to pick a username,
 * a returning one drops straight into the app.
 */
export function Connect() {
  const navigate = useNavigate();
  const { status, connect, connecting, error } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Once connected, the guard-aware redirect runs based on status.
  useEffect(() => {
    if (status === 'needs-username') navigate('/onboard', { replace: true });
    else if (status === 'ready') navigate('/play', { replace: true });
  }, [status, navigate]);

  async function handleSelect(provider: SolanaProvider) {
    try {
      await connect(provider);
      setPickerOpen(false);
    } catch {
      // error surfaced via the auth store; keep the picker open to retry
    }
  }

  return (
    <div className="app-backdrop grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-card-lg border border-edge bg-turf p-7 text-center">
        <span className="inline-flex items-baseline text-3xl font-extrabold tracking-tightest text-chalk">
          Field<span className="text-grass">.</span>
        </span>
        <h1 className="mt-5 text-xl font-extrabold tracking-display text-chalk">
          Connect your wallet
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your wallet is your account.
        </p>

        <Button
          variant="grass"
          size="lg"
          fullWidth
          className="mt-6"
          onClick={() => setPickerOpen(true)}
          disabled={connecting}
          leftIcon={<WalletIcon size={20} />}
        >
          {connecting ? 'Connecting…' : 'Connect Solana wallet'}
        </Button>

        {error && <p className="mt-3 text-xs text-flare-2">{error}</p>}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Join the fun.
        </p>
      </div>

      <WalletPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        connecting={connecting}
      />
    </div>
  );
}
