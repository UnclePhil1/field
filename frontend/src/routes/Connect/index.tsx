import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthStore';
import { Button } from '../../components/Button';
import { WalletIcon } from '../../components/Icons';
import { isWalletAvailable } from '../../lib/wallet';

/**
 * Wallet sign-up / sign-in screen. Connecting a Solana wallet IS the
 * account: a brand-new wallet is routed to /onboard to pick a username,
 * a returning one drops straight into the app.
 */
export function Connect() {
  const navigate = useNavigate();
  const { status, connect, connecting, error } = useAuth();
  const hasWallet = isWalletAvailable();

  // Once connected, the guard-aware redirect runs based on status.
  useEffect(() => {
    if (status === 'needs-username') navigate('/onboard', { replace: true });
    else if (status === 'ready') navigate('/', { replace: true });
  }, [status, navigate]);

  async function handleConnect() {
    try {
      await connect();
    } catch {
      // error surfaced via the auth store
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
          onClick={handleConnect}
          disabled={connecting}
          leftIcon={<WalletIcon size={20} />}
        >
          {connecting ? 'Connecting…' : 'Connect Solana wallet'}
        </Button>

        {error && <p className="mt-3 text-xs text-flare-2">{error}</p>}

        {!hasWallet && (
          <p className="mt-3 text-xs text-muted">
            No Solana wallet detected. Install any Solana wallet —{' '}
            <a href="https://phantom.app" target="_blank" rel="noreferrer" className="text-grass hover:underline">Phantom</a>,{' '}
            <a href="https://solflare.com" target="_blank" rel="noreferrer" className="text-grass hover:underline">Solflare</a>, or{' '}
            <a href="https://backpack.app" target="_blank" rel="noreferrer" className="text-grass hover:underline">Backpack</a>{' '}
            — to sign in.
          </p>
        )}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Join the fun.
        </p>
      </div>
    </div>
  );
}
