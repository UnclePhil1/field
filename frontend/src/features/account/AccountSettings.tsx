import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import type { Provider } from '@reown/appkit-adapter-solana/react';
import { useAuth } from '../../app/AuthStore';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { WalletIcon } from '../../components/Icons';
import { buildSignInPayload, shortAddress } from '../../lib/wallet';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function AccountSettings() {
  const { username, wallet, setUsername, linkWallet } = useAuth();
  return (
    <section className="rounded-card border border-edge bg-turf p-4">
      <StatLabel>Account</StatLabel>
      <div className="mt-3 flex flex-col gap-4">
        <UsernameRow username={username} setUsername={setUsername} />
        <WalletRow wallet={wallet} linkWallet={linkWallet} />
      </div>
    </section>
  );
}

function UsernameRow({ username, setUsername }: { username: string | null; setUsername: (n: string) => Promise<void> }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (username) {
    return (
      <Field label="Username">
        <span className="text-sm font-semibold text-chalk">@{username}</span>
      </Field>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!USERNAME_RE.test(value.trim())) { setErr('3–20 letters, numbers or underscores.'); return; }
    setBusy(true); setErr(null);
    try {
      await setUsername(value.trim());
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Field label="Username">
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => { setValue(e.target.value); setErr(null); }}
            placeholder="Pick a username"
            autoCapitalize="none"
            className="h-10 flex-1 rounded-[12px] border border-edge-2 bg-turf-2 px-3 text-sm text-chalk outline-none focus:border-grass/60"
          />
          <Button variant="grass" size="sm" type="submit" disabled={busy || !value.trim()}>{busy ? '…' : 'Save'}</Button>
        </div>
        {err && <p className="mt-1 text-xs text-flare-2">{err}</p>}
      </Field>
    </form>
  );
}

function WalletRow({ wallet, linkWallet }: { wallet: string | null; linkWallet: (s: import('../../lib/wallet').WalletSignIn) => Promise<void> }) {
  const { status } = useAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('solana');
  const [linking, setLinking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!linking || !isConnected || !address || !walletProvider || attempted.current === address) return;
    attempted.current = address;
    (async () => {
      try {
        const signed = await buildSignInPayload(address, walletProvider as unknown as { signMessage: (m: Uint8Array) => Promise<Uint8Array> });
        await linkWallet(signed);
        setLinking(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not link wallet');
        attempted.current = null;
        setLinking(false);
      }
    })();
  }, [linking, isConnected, address, walletProvider, linkWallet]);

  if (wallet) {
    return (
      <Field label="Wallet">
        <span className="tabular text-sm font-semibold text-chalk">{shortAddress(wallet, 6, 6)}</span>
      </Field>
    );
  }

  return (
    <Field label="Wallet">
      <Button
        variant="turf"
        size="sm"
        leftIcon={<WalletIcon size={15} />}
        disabled={status !== 'ready' || linking}
        onClick={() => { setErr(null); setLinking(true); open(); }}
      >
        {linking ? 'Approve in your wallet…' : 'Connect a wallet'}
      </Button>
      <p className="mt-1 text-xs text-muted">Needed to host tournaments or claim prizes.</p>
      {err && <p className="mt-1 text-xs text-flare-2">{err}</p>}
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1">{label}</p>
      {children}
    </div>
  );
}
