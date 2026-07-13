import { readFileSync } from 'node:fs';
import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import nacl from 'tweetnacl';

const RPC = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';
const AUTH_BASE = process.env.TXLINE_AUTH_BASE ?? 'https://txline.txodds.com';
const PROGRAM_ID = new PublicKey('9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA');
const TXL_TOKEN_MINT = new PublicKey('Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL');

const SERVICE_LEVEL_ID = Number(process.env.TXLINE_SERVICE_LEVEL ?? '12');
const DURATION_WEEKS = Number(process.env.TXLINE_DURATION_WEEKS ?? '4');
const SELECTED_LEAGUES = []; // empty = standard World Cup bundle

const keypairPath = process.argv[2];
if (!keypairPath) {
  console.error('Usage: node txline-subscribe.mjs <path-to-wallet-keypair.json>');
  process.exit(1);
}
const secret = Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8')));
const walletKeypair = Keypair.fromSecretKey(secret);
const wallet = new anchor.Wallet(walletKeypair);

const connection = new Connection(RPC, 'confirmed');
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
anchor.setProvider(provider);

console.log('Wallet:', wallet.publicKey.toBase58());
const balance = await connection.getBalance(wallet.publicKey);
console.log('Balance:', (balance / 1e9).toFixed(4), 'SOL');
if (balance < 3_000_000) {
  console.error('\n⚠  Low balance. Fund this wallet with a little SOL (≈0.01) for gas, then re-run.');
  process.exit(1);
}

const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from('token_treasury_v2')], PROGRAM_ID);
const tokenTreasuryVault = getAssociatedTokenAddressSync(TXL_TOKEN_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID);
const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from('pricing_matrix')], PROGRAM_ID);

const userTokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  walletKeypair,
  TXL_TOKEN_MINT,
  wallet.publicKey,
  false,
  'confirmed',
  undefined,
  TOKEN_2022_PROGRAM_ID,
);

const idl = JSON.parse(readFileSync(new URL('./txoracle-idl.json', import.meta.url), 'utf8'));
idl.address ??= PROGRAM_ID.toBase58();
const program = new anchor.Program(idl, provider);

async function readToken(res) {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j.token ?? j.jwt ?? j.apiToken ?? (typeof j === 'string' ? j : text.trim());
  } catch {
    return text.trim();
  }
}

let txSig = process.env.TXLINE_TX_SIG;
if (txSig) {
  console.log('\nUsing existing subscription tx:', txSig, '(skipping subscribe)');
} else {
  console.log(`\nSubscribing: service level ${SERVICE_LEVEL_ID}, ${DURATION_WEEKS} weeks …`);
  txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: wallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TXL_TOKEN_MINT,
      userTokenAccount: userTokenAccount.address,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  console.log('Subscription tx:', txSig);
  console.log('(tip: if a later step fails, re-run with  TXLINE_TX_SIG=' + txSig + '  to avoid paying gas again)');
}

const authRes = await fetch(`${AUTH_BASE}/auth/guest/start`, { method: 'POST' });
if (!authRes.ok) {
  console.error('guest/start failed:', authRes.status, await authRes.text());
  process.exit(1);
}
const jwt = await readToken(authRes);
if (!jwt) throw new Error('guest/start did not return a token');

const messageString = `${txSig}:${SELECTED_LEAGUES.join(',')}:${jwt}`;
const signature = nacl.sign.detached(new TextEncoder().encode(messageString), walletKeypair.secretKey);
const walletSignature = Buffer.from(signature).toString('base64');

const actRes = await fetch(`${AUTH_BASE}/api/token/activate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
});
if (!actRes.ok) {
  console.error('Activation failed:', actRes.status, await actRes.text());
  process.exit(1);
}
const apiToken = await readToken(actRes);

console.log('\n✅  Done. Set this in Supabase:\n');
console.log(`   supabase secrets set TXLINE_API_TOKEN=${apiToken}`);
console.log('\nAlso confirm these point at mainnet:');
console.log('   supabase secrets set TXLINE_BASE=https://txline.txodds.com');
console.log('   supabase secrets set TXLINE_AUTH_BASE=https://txline.txodds.com');
