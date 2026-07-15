import { readFileSync } from 'node:fs';
import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';

const RPC = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';
const CARD_ID = process.argv[2];
const FN_BASE = 'https://tjaurmvytdeumynjteca.supabase.co/functions/v1';
const ANON = process.env.SUPA_ANON;

const secret = Uint8Array.from(JSON.parse(readFileSync(new URL('./my-wallet.json', import.meta.url), 'utf8')));
const walletKeypair = Keypair.fromSecretKey(secret);
const wallet = new anchor.Wallet(walletKeypair);
const connection = new Connection(RPC, 'confirmed');
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
anchor.setProvider(provider);

const idl = JSON.parse(readFileSync(new URL('./txoracle-idl.json', import.meta.url), 'utf8'));
const program = new anchor.Program(idl, provider);

const res = await fetch(`${FN_BASE}/txline-proof`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
  body: JSON.stringify({ cardId: CARD_ID }),
});
const { proof: v, receipt } = await res.json();
if (!v) { console.error('no proof for card'); process.exit(1); }
console.log('proof fetched: stat', v.statToProve, 'fixture', v.summary.fixtureId);

const toBytes32 = (a) => Array.from(a);
const toNodes = (nodes) => (nodes ?? []).map((n) => ({ hash: toBytes32(n.hash), isRightSibling: n.isRightSibling ?? n.is_right_sibling }));

const targetTs = v.summary.updateStats.minTimestamp;
const epochDay = Math.floor(targetTs / 86_400_000);
const [pda] = PublicKey.findProgramAddressSync(
  [Buffer.from('daily_scores_roots'), new anchor.BN(epochDay).toArrayLike(Buffer, 'le', 2)],
  program.programId,
);
console.log('epochDay', epochDay, 'pda', pda.toBase58());

const fixtureSummary = {
  fixtureId: new anchor.BN(v.summary.fixtureId),
  updateStats: {
    updateCount: v.summary.updateStats.updateCount,
    minTimestamp: new anchor.BN(v.summary.updateStats.minTimestamp),
    maxTimestamp: new anchor.BN(v.summary.updateStats.maxTimestamp),
  },
  eventsSubTreeRoot: toBytes32(v.summary.eventStatsSubTreeRoot),
};
const statA = {
  statToProve: { key: v.statToProve.key, value: v.statToProve.value, period: v.statToProve.period },
  eventStatRoot: toBytes32(v.eventStatRoot),
  statProof: toNodes(v.statProof),
};
const predicate = { threshold: v.statToProve.value, comparison: { equalTo: {} } };

const memoText = `FanField proof · ${receipt.statVerified} · fixture ${v.summary.fixtureId} · key ${v.statToProve.key} · validate_stat`;
const memoIx = new TransactionInstruction({
  keys: [],
  programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
  data: Buffer.from(memoText, 'utf8'),
});
const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

const sig = await program.methods
  .validateStat(new anchor.BN(targetTs), fixtureSummary, toNodes(v.subTreeProof), toNodes(v.mainTreeProof), predicate, statA, null, null)
  .accounts({ dailyScoresMerkleRoots: pda })
  .preInstructions([cuIx])
  .postInstructions([memoIx])
  .rpc();

console.log('\nANCHORED ON-CHAIN');
console.log('tx:', sig);
console.log('explorer: https://explorer.solana.com/tx/' + sig);
