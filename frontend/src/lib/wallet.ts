// Lightweight Solana wallet connector.
//
// We talk to an injected Phantom-compatible provider (`window.solana`)
// directly so the bundle stays dependency-free. The wallet both identifies the
// user and signs a login message that the `wallet-auth` Edge Function verifies.

export interface SolanaProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signMessage?: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<{ signature: Uint8Array }>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
    glow?: SolanaProvider;
    coin98?: { sol?: SolanaProvider };
  }
}

// Known Solana wallets we surface in the picker. Each resolves its injected
// provider if installed. `brand` is a Field-token-friendly accent for the badge.
interface WalletDef {
  id: string;
  name: string;
  brand: string;
  url: string; // install page
  resolve: () => SolanaProvider | undefined;
}

const CATALOG: WalletDef[] = [
  { id: 'phantom', name: 'Phantom', brand: '#ab9ff2', url: 'https://phantom.app',
    resolve: () => window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : undefined) },
  { id: 'solflare', name: 'Solflare', brand: '#ffc23f', url: 'https://solflare.com',
    resolve: () => window.solflare },
  { id: 'backpack', name: 'Backpack', brand: '#e33e3f', url: 'https://backpack.app',
    resolve: () => window.backpack },
  { id: 'glow', name: 'Glow', brand: '#9b8cff', url: 'https://glow.app',
    resolve: () => window.glow },
  { id: 'coin98', name: 'Coin98', brand: '#cda434', url: 'https://coin98.com',
    resolve: () => window.coin98?.sol },
];

export interface WalletOption {
  id: string;
  name: string;
  brand: string;
  url: string;
  /** the injected provider, or null if the wallet isn't installed */
  provider: SolanaProvider | null;
}

/** The catalog with live detection — installed wallets have a provider. */
export function detectWallets(): WalletOption[] {
  return CATALOG.map((w) => {
    const p = w.resolve();
    const ok = p && typeof p.connect === 'function' ? p : null;
    return { id: w.id, name: w.name, brand: w.brand, url: w.url, provider: ok };
  });
}

/** First installed provider that can sign (fallback / quick path). */
export function getProvider(): SolanaProvider | null {
  const installed = detectWallets().map((w) => w.provider).filter((p): p is SolanaProvider => !!p);
  return installed.find((p) => typeof p.signMessage === 'function') ?? installed[0] ?? null;
}

export function isWalletAvailable(): boolean {
  return detectWallets().some((w) => w.provider);
}

/** Shorten an address for display: `7xKa…9fQ2`. */
export function shortAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

// base58 encoder (no dependency) — used to encode the signature for the server.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

export interface WalletSignIn {
  wallet: string;
  message: string;
  signature: string; // base58
}

/**
 * Connect a (chosen) wallet and produce a signed login message for the backend.
 * Pass the provider from the picker; falls back to the first installed wallet.
 * Throws if no wallet is present or the user rejects.
 */
export async function connectAndSign(chosen?: SolanaProvider): Promise<WalletSignIn> {
  const provider = chosen ?? getProvider();
  if (!provider) throw new Error('No Solana wallet found. Install a Solana wallet (Phantom, Solflare, Backpack…) to continue.');
  if (!provider.signMessage) throw new Error('This wallet does not support message signing.');

  const { publicKey } = await provider.connect();
  const wallet = publicKey.toString();
  const nonce = Math.random().toString(36).slice(2);
  const message = `Sign in to Field\nwallet: ${wallet}\nnonce: ${nonce}`;
  const { signature } = await provider.signMessage(new TextEncoder().encode(message), 'utf8');
  return { wallet, message, signature: base58(signature) };
}

export async function disconnectWallet(): Promise<void> {
  try {
    await getProvider()?.disconnect();
  } catch {
    // best-effort
  }
}
