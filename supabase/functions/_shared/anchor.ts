// Sends a validate_stat transaction to the TxODDS oracle program so each settled
// card's proof is checked on-chain. Needs ANCHOR_WALLET_SECRET (Solana keypair
// JSON array) with a little SOL for fees.
// deno-lint-ignore-file no-explicit-any
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from 'npm:@solana/web3.js@1.95.8';

const RPC = Deno.env.get('SOLANA_RPC') ?? 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey(Deno.env.get('TXLINE_PROGRAM_ID') ?? '9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA');
const MEMO_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const SECRET = Deno.env.get('ANCHOR_WALLET_SECRET') ?? '';
const DISC_VALIDATE_STAT = [107, 197, 232, 90, 191, 136, 105, 185];

export const anchorEnabled = !!SECRET;

class Writer {
  private parts: number[] = [];
  u8(n: number) { this.parts.push(n & 0xff); }
  bool(b: boolean) { this.u8(b ? 1 : 0); }
  u32(n: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); this.raw(b); }
  i32(n: number) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n | 0, true); this.raw(b); }
  i64(n: number | bigint) { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(n), true); this.raw(b); }
  bytes32(a: number[]) { if (a.length !== 32) throw new Error('need 32 bytes'); this.raw(Uint8Array.from(a)); }
  raw(b: Uint8Array | number[]) { for (const x of b) this.parts.push(x); }
  nodes(list: any[]) {
    this.u32(list.length);
    for (const n of list) { this.bytes32(n.hash); this.bool(n.isRightSibling ?? n.is_right_sibling ?? false); }
  }
  out(): Uint8Array { return Uint8Array.from(this.parts); }
}

function encodeValidateStat(v: any): Uint8Array {
  const w = new Writer();
  w.raw(DISC_VALIDATE_STAT);
  const ts = v.summary.updateStats.minTimestamp;
  w.i64(ts);
  w.i64(v.summary.fixtureId);
  w.i32(v.summary.updateStats.updateCount);
  w.i64(v.summary.updateStats.minTimestamp);
  w.i64(v.summary.updateStats.maxTimestamp);
  w.bytes32(v.summary.eventStatsSubTreeRoot);
  w.nodes(v.subTreeProof ?? []);
  w.nodes(v.mainTreeProof ?? []);
  w.i32(v.statToProve.value);
  w.u8(2); // Comparison::EqualTo
  w.u32(v.statToProve.key);
  w.i32(v.statToProve.value);
  w.i32(v.statToProve.period);
  w.bytes32(v.eventStatRoot);
  w.nodes(v.statProof ?? []);
  w.u8(0); // stat_b: None
  w.u8(0); // op: None
  return w.out();
}

export async function anchorStatOnChain(validation: any, memoText: string): Promise<string | null> {
  if (!SECRET) return null;
  try {
    const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(SECRET)));
    const connection = new Connection(RPC, 'confirmed');

    const epochDay = Math.floor(Number(validation.summary.updateStats.minTimestamp) / 86_400_000);
    const dayBuf = new Uint8Array(2);
    new DataView(dayBuf.buffer).setUint16(0, epochDay, true);
    const [pda] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode('daily_scores_roots'), dayBuf],
      PROGRAM_ID,
    );

    const validateIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [{ pubkey: pda, isSigner: false, isWritable: false }],
      data: encodeValidateStat(validation) as any,
    });
    const memoIx = new TransactionInstruction({
      programId: MEMO_ID,
      keys: [],
      data: new TextEncoder().encode(memoText.slice(0, 500)) as any,
    });
    const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

    const tx = new Transaction().add(cuIx, validateIx, memoIx);
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    tx.sign(keypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    for (let i = 0; i < 8; i++) {
      const st = await connection.getSignatureStatuses([sig]);
      const s = st.value[0];
      if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return sig;
  } catch (e) {
    console.error('anchor failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
