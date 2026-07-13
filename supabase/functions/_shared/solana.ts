import { Connection, PublicKey } from 'npm:@solana/web3.js@1.95.4';

const CLUSTER = Deno.env.get('SOLANA_CLUSTER') ?? 'devnet';
const RPC = Deno.env.get('SOLANA_RPC') ??
  (CLUSTER === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com');
const USDC_MINT = Deno.env.get('USDC_MINT') ??
  (CLUSTER === 'mainnet-beta'
    ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

export function isValidSolanaAddress(addr: string): boolean {
  try {
    new PublicKey(addr);
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  } catch {
    return false;
  }
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export async function verifyUsdcPayment(txSig: string, winnerWallet: string, amount: number): Promise<VerifyResult> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txSig.trim())) {
    return { ok: false, reason: 'Not a valid transaction signature' };
  }
  const conn = new Connection(RPC, 'confirmed');
  let tx;
  try {
    tx = await conn.getParsedTransaction(txSig.trim(), { maxSupportedTransactionVersion: 0 });
  } catch (e) {
    return { ok: false, reason: `Could not fetch transaction: ${e instanceof Error ? e.message : e}` };
  }
  if (!tx) return { ok: false, reason: 'Transaction not found or not yet confirmed' };
  if (tx.meta?.err) return { ok: false, reason: 'Transaction failed on-chain' };

  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];

  const balFor = (list: typeof post) =>
    list
      .filter((b) => b.mint === USDC_MINT && b.owner === winnerWallet)
      .reduce((sum, b) => sum + (b.uiTokenAmount.uiAmount ?? 0), 0);

  const delta = balFor(post) - balFor(pre);
  if (delta + 1e-6 < amount) {
    return { ok: false, reason: `USDC received (${delta}) is less than required (${amount})` };
  }
  return { ok: true };
}
