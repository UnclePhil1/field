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
  }
}

export function getProvider(): SolanaProvider | null {
  if (typeof window === 'undefined') return null;
  return window.phantom?.solana ?? window.solana ?? null;
}

export function isWalletAvailable(): boolean {
  return getProvider() != null;
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
 * Connect the wallet and produce a signed login message for the backend.
 * Throws if no wallet is present or the user rejects.
 */
export async function connectAndSign(): Promise<WalletSignIn> {
  const provider = getProvider();
  if (!provider) throw new Error('No Solana wallet found. Install Phantom to continue.');
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
