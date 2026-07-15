import { readFileSync } from 'node:fs';
import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

const secret = Uint8Array.from(JSON.parse(readFileSync(new URL('./my-wallet.json', import.meta.url), 'utf8')));
const wallet = new anchor.Wallet(Keypair.fromSecretKey(secret));
const provider = new anchor.AnchorProvider(new Connection('https://api.mainnet-beta.solana.com'), wallet, {});
const idl = JSON.parse(readFileSync(new URL('./txoracle-idl.json', import.meta.url), 'utf8'));
const program = new anchor.Program(idl, provider);

const envText = readFileSync(new URL('../../frontend/.env', import.meta.url), 'utf8');
const ANON = envText.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)[1].replace(/"/g, '').trim();
const res = await fetch('https://tjaurmvytdeumynjteca.supabase.co/functions/v1/txline-proof', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
  body: JSON.stringify({ cardId: '7824ce3f-a699-4cb8-aed5-4103a29a598e' }),
});
const { proof: v } = await res.json();

const toNodes = (ns) => (ns ?? []).map((n) => ({ hash: Array.from(n.hash), isRightSibling: n.isRightSibling }));
const ts = v.summary.updateStats.minTimestamp;
const [pda] = PublicKey.findProgramAddressSync(
  [Buffer.from('daily_scores_roots'), new anchor.BN(Math.floor(ts / 86400000)).toArrayLike(Buffer, 'le', 2)],
  program.programId,
);

const ix = await program.methods.validateStat(
  new anchor.BN(ts),
  {
    fixtureId: new anchor.BN(v.summary.fixtureId),
    updateStats: {
      updateCount: v.summary.updateStats.updateCount,
      minTimestamp: new anchor.BN(v.summary.updateStats.minTimestamp),
      maxTimestamp: new anchor.BN(v.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: Array.from(v.summary.eventStatsSubTreeRoot),
  },
  toNodes(v.subTreeProof),
  toNodes(v.mainTreeProof),
  { threshold: v.statToProve.value, comparison: { equalTo: {} } },
  { statToProve: v.statToProve, eventStatRoot: Array.from(v.eventStatRoot), statProof: toNodes(v.statProof) },
  null,
  null,
).accounts({ dailyScoresMerkleRoots: pda }).instruction();

const parts = [];
const u8 = (n) => parts.push(n & 0xff);
const raw = (b) => { for (const x of b) parts.push(x); };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); raw(b); };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n | 0); raw(b); };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); raw(b); };
const nodes = (list) => { u32(list.length); for (const n of list) { raw(n.hash); u8(n.isRightSibling ? 1 : 0); } };
raw([107, 197, 232, 90, 191, 136, 105, 185]);
i64(ts);
i64(v.summary.fixtureId);
i32(v.summary.updateStats.updateCount);
i64(v.summary.updateStats.minTimestamp);
i64(v.summary.updateStats.maxTimestamp);
raw(v.summary.eventStatsSubTreeRoot);
nodes(v.subTreeProof);
nodes(v.mainTreeProof);
i32(v.statToProve.value);
u8(2);
u32(v.statToProve.key);
i32(v.statToProve.value);
i32(v.statToProve.period);
raw(v.eventStatRoot);
nodes(v.statProof);
u8(0);
u8(0);

const mine = Buffer.from(parts);
console.log('anchor bytes:', ix.data.length, '| manual bytes:', mine.length);
console.log('MATCH:', Buffer.compare(ix.data, mine) === 0);
process.exit(0);
