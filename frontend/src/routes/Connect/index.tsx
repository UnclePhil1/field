import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import type { Provider } from '@reown/appkit-adapter-solana/react';
import { useAuth } from '../../app/AuthStore';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { WalletIcon } from '../../components/Icons';
import { buildSignInPayload } from '../../lib/wallet';

/**
 * Wallet sign-in via Reown AppKit. Tapping "Connect" opens the AppKit modal
 * (WalletConnect + injected + mobile deep links). Once a wallet is connected we
 * ask it to sign a login message and exchange it for a Supabase session.
 */
export function Connect() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  const { status, authenticate, connecting, error } = useAuth();

  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('solana');
  const [signing, setSigning] = useState(false);
  const attempted = useRef<string | null>(null);

  // Route onward once we have a session, preserving any shared deep-link.
  useEffect(() => {
    const q = redirect ? `?redirect=${redirect}` : '';
    if (status === 'needs-username') navigate(`/onboard${q}`, { replace: true });
    else if (status === 'ready') navigate(redirect ? decodeURIComponent(redirect) : '/play', { replace: true });
  }, [status, navigate, redirect]);

  // When a wallet connects (and we have no session yet), sign in.
  useEffect(() => {
    if (status !== 'guest') return;
    if (!isConnected || !address || !walletProvider) return;
    if (attempted.current === address) return; // one attempt per address
    attempted.current = address;
    setSigning(true);
    (async () => {
      try {
        const signed = await buildSignInPayload(address, walletProvider as unknown as { signMessage: (m: Uint8Array) => Promise<Uint8Array> });
        await authenticate(signed);
      } catch {
        attempted.current = null; // allow retry on failure/rejection
      } finally {
        setSigning(false);
      }
    })();
  }, [isConnected, address, walletProvider, status, authenticate]);

  const busy = signing || connecting;

  return (
    <div className="app-backdrop grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-card-lg border border-edge bg-turf p-7 text-center">
        <span className="inline-flex items-center gap-2 text-3xl font-extrabold tracking-tightest text-chalk">
          <Logo size={55} className="rounded-full" />
          {/* <span className="inline-flex items-baseline">Field<span className="text-grass">.</span></span> */}
        </span>
        <h1 className="mt-5 text-xl font-extrabold tracking-display text-chalk">Connect your wallet</h1>
        <p className="mt-2 text-sm text-muted">Your wallet is your account.</p>

        <Button
          variant="grass"
          size="lg"
          fullWidth
          className="mt-6"
          onClick={() => open()}
          disabled={busy}
          leftIcon={<WalletIcon size={20} />}
        >
          {busy ? (signing ? 'Approve in your wallet…' : 'Signing in…') : 'Connect Solana wallet'}
        </Button>

        {error && <p className="mt-3 text-xs text-flare-2">{error}</p>}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Any Solana wallet works — mobile or desktop. No signup, no password.
        </p>
      </div>
    </div>
  );
}
