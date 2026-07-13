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
  provider: SolanaProvider | null;
}

export function detectWallets(): WalletOption[] {
  return CATALOG.map((w) => {
    const p = w.resolve();
    const ok = p && typeof p.connect === 'function' ? p : null;
    return { id: w.id, name: w.name, brand: w.brand, url: w.url, provider: ok };
  });
}

export function getProvider(): SolanaProvider | null {
  const installed = detectWallets().map((w) => w.provider).filter((p): p is SolanaProvider => !!p);
  return installed.find((p) => typeof p.signMessage === 'function') ?? installed[0] ?? null;
}

export function isWalletAvailable(): boolean {
  return detectWallets().some((w) => w.provider);
}

export function isInWalletBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Phantom|Solflare|Backpack|MetaMask|CoinbaseWallet|Trust|imToken|TokenPocket/i.test(navigator.userAgent || '');
}

export function shortAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

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

export interface SignMessageProvider {
  signMessage: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
}

export async function buildSignInPayload(wallet: string, provider: SignMessageProvider): Promise<WalletSignIn> {
  const nonce = Math.random().toString(36).slice(2);
  const message = `Sign in to Field\nwallet: ${wallet}\nnonce: ${nonce}`;
  const res = await provider.signMessage(new TextEncoder().encode(message));
  const sig = res instanceof Uint8Array ? res : res.signature;
  return { wallet, message, signature: base58(sig) };
}

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
  }
}
