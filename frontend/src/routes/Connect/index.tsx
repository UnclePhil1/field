import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import type { Provider } from '@reown/appkit-adapter-solana/react';
import { useAuth } from '../../app/AuthStore';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { WalletIcon, EyeIcon, EyeOffIcon } from '../../components/Icons';
import { buildSignInPayload } from '../../lib/wallet';

type Tab = 'username' | 'wallet';

export function Connect() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  const { status, authenticateWallet, registerUsername, loginUsername, connecting, error, clearError } = useAuth();

  const [tab, setTab] = useState<Tab>('username');

  // route onward once we have a session (preserve a shared deep-link)
  useEffect(() => {
    if (status === 'ready') navigate(redirect ? decodeURIComponent(redirect) : '/play', { replace: true });
  }, [status, navigate, redirect]);

  return (
    <div className="app-backdrop grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-card-lg border border-edge bg-turf p-7">
        <div className="flex items-center justify-center gap-2 text-3xl font-extrabold tracking-tightest text-chalk">
          <Logo size={30} />
          <span className="inline-flex items-baseline">Field<span className="text-grass">.</span></span>
        </div>

        {/* tab switch */}
        <div className="mt-6 flex gap-1 rounded-full border border-edge bg-pitch-deep/40 p-1">
          {(['username', 'wallet'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); clearError(); }}
              className={[
                'flex-1 rounded-full py-2 text-sm font-semibold capitalize transition-colors',
                tab === t ? 'bg-grass/15 text-grass' : 'text-muted hover:text-chalk',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'username' ? (
          <UsernameForm
            onRegister={registerUsername}
            onLogin={loginUsername}
            busy={connecting}
            error={error}
            clearError={clearError}
          />
        ) : (
          <WalletConnect authenticate={authenticateWallet} status={status} busy={connecting} error={error} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- username ------------------------------- */
function UsernameForm({
  onRegister,
  onLogin,
  busy,
  error,
  clearError,
}: {
  onRegister: (u: string, p: string) => Promise<void>;
  onLogin: (u: string, p: string) => Promise<void>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (mode === 'register') await onRegister(username.trim(), password);
      else await onLogin(username.trim(), password);
    } catch {
      /* surfaced via error */
    }
  }

  return (
    <form onSubmit={submit} className="mt-5">
      <input
        value={username}
        onChange={(e) => { setUsername(e.target.value); clearError(); }}
        placeholder="Username"
        autoCapitalize="none"
        className="mb-2 h-11 w-full rounded-[13px] border border-edge-2 bg-turf-2 px-3 text-sm font-semibold text-chalk outline-none focus:border-grass/60"
      />
      <div className="relative">
        <input
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={(e) => { setPassword(e.target.value); clearError(); }}
          placeholder="Password"
          className="h-11 w-full rounded-[13px] border border-edge-2 bg-turf-2 px-3 pr-11 text-sm font-semibold text-chalk outline-none focus:border-grass/60"
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          aria-label={showPw ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted hover:text-chalk"
        >
          {showPw ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-flare-2">{error}</p>}
      <Button variant="grass" size="lg" fullWidth className="mt-4" type="submit" disabled={busy || !username.trim() || password.length < 6}>
        {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
      </Button>
      <button
        type="button"
        onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); clearError(); }}
        className="mt-3 w-full text-center text-xs text-muted hover:text-chalk"
      >
        {mode === 'register' ? 'Already have an account? Log in' : 'New here? Create an account'}
      </button>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        No wallet needed to play. You can connect one later to host or claim prizes.
      </p>
    </form>
  );
}

/* -------------------------------- wallet -------------------------------- */
function WalletConnect({
  authenticate,
  status,
  busy,
  error,
}: {
  authenticate: (signed: import('../../lib/wallet').WalletSignIn) => Promise<void>;
  status: string;
  busy: boolean;
  error: string | null;
}) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('solana');
  const attempted = useRef<string | null>(null);
  const [signing, setSigning] = useState(false);
  // Only sign after the user explicitly taps connect — never auto-sign a
  // cached AppKit connection (that was popping the extension unprompted).
  const [initiated, setInitiated] = useState(false);

  useEffect(() => {
    if (status !== 'guest' || !initiated) return;
    if (!isConnected || !address || !walletProvider || attempted.current === address) return;
    attempted.current = address;
    setSigning(true);
    (async () => {
      try {
        const signed = await buildSignInPayload(address, walletProvider as unknown as { signMessage: (m: Uint8Array) => Promise<Uint8Array> });
        await authenticate(signed);
      } catch {
        attempted.current = null;
      } finally {
        setSigning(false);
      }
    })();
  }, [initiated, isConnected, address, walletProvider, status, authenticate]);

  const working = signing || busy;
  return (
    <div className="mt-5 text-center">
      <Button
        variant="grass"
        size="lg"
        fullWidth
        onClick={() => { setInitiated(true); if (!isConnected) open(); }}
        disabled={working}
        leftIcon={<WalletIcon size={20} />}
      >
        {working ? 'Approve in your wallet…' : 'Connect Solana wallet'}
      </Button>
      {error && <p className="mt-3 text-xs text-flare-2">{error}</p>}
      <p className="mt-4 text-[11px] leading-relaxed text-muted">Any Solana wallet works. Your wallet is your account.</p>
    </div>
  );
}
