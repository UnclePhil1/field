// End-to-end test of the no-escrow tournament flow against the deployed backend.
//   create → join → settle → winner submits address → host mark-paid (verify).
// Auth uses the funded wallet keypair (same one the subscribe script used).
//   node test-tournament.mjs ./my-wallet.json
import { readFileSync } from 'node:fs';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Configure via env so no secrets live in the repo:
//   PROJ_URL=... ANON_KEY=... CRON_SECRET=... node test-tournament.mjs ./my-wallet.json
const PROJ = process.env.PROJ_URL ?? 'https://tjaurmvytdeumynjteca.supabase.co';
const KEY = process.env.ANON_KEY ?? '';
const CRON_SECRET = process.env.CRON_SECRET ?? '';
const FN = `${PROJ}/functions/v1`;

const kpPath = process.argv[2] ?? './my-wallet.json';
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(kpPath, 'utf8'))));
const wallet = kp.publicKey.toBase58();

const ok = (s) => console.log('  \x1b[32m✓\x1b[0m', s);
const bad = (s) => console.log('  \x1b[31m✗\x1b[0m', s);

async function call(method, path, { token, body, cron } = {}) {
  const headers = { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${token ?? KEY}` };
  if (cron) headers['x-cron-secret'] = CRON_SECRET;
  const res = await fetch(`${FN}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  console.log('\nWallet:', wallet, '\n');

  // 1. auth
  console.log('1. wallet-auth');
  const msg = `Sign in to Field\nwallet: ${wallet}\nnonce: ${Math.random().toString(36).slice(2)}`;
  const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey));
  const auth = await call('POST', '/wallet-auth', { body: { wallet, message: msg, signature: sig } });
  const token = auth.json?.session?.access_token;
  token ? ok('signed in') : bad(`auth failed: ${JSON.stringify(auth.json)}`);
  if (!token) return;

  // find an upcoming match
  const m = await fetch(`${PROJ}/rest/v1/matches?status=eq.upcoming&select=id&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  }).then((r) => r.json());
  const matchId = m[0]?.id;
  console.log('   upcoming match:', matchId);

  // 2. create
  console.log('2. create tournament');
  const create = await call('POST', '/tournaments', {
    token,
    body: {
      title: 'E2E Test Battle', description: 'Automated test', bannerUrl: '',
      matchId, hostPayoutWallet: wallet, prize: { asset: 'USDC', total: 100 },
      capacity: { type: 'open' }, winnersCount: 1, split: [100], startingPoints: 1000, joinCloses: 'kickoff',
    },
  });
  const id = create.json?.id;
  id ? ok(`created ${id}`) : bad(`create failed (${create.status}): ${JSON.stringify(create.json)}`);
  if (!id) return;

  // 3. join
  console.log('3. join (free)');
  const join = await call('POST', `/tournaments/${id}/join`, { token });
  join.json?.ok ? ok(`joined with ${join.json.points} pts`) : bad(`join failed: ${JSON.stringify(join.json)}`);

  // 4. me + standings
  const me = await call('GET', `/tournaments/${id}/me`, { token });
  me.json?.joined ? ok(`/me → ${me.json.points} pts`) : bad(`/me: ${JSON.stringify(me.json)}`);
  const st = await call('GET', `/tournaments/${id}/standings`, { token });
  Array.isArray(st.json) ? ok(`standings: ${st.json.length} player(s)`) : bad(`standings: ${JSON.stringify(st.json)}`);

  // 5. settle (cron authority)
  console.log('5. settle (finalize standings → payouts)');
  const settle = await call('POST', `/tournaments/${id}/settle`, { cron: true });
  settle.json?.ok ? ok(`settled, winners=${settle.json.winners}`) : bad(`settle failed (${settle.status}): ${JSON.stringify(settle.json)}`);

  // 6. payouts
  const pay = await call('GET', `/tournaments/${id}/payouts`, { token });
  const myPayout = (pay.json || []).find((p) => p.isMe);
  myPayout ? ok(`payout: #${myPayout.rank} $${myPayout.amount} (${myPayout.status})`) : bad(`no payout: ${JSON.stringify(pay.json)}`);

  // 7. winner submits address
  console.log('7. winner submits USDC address');
  const addr = await call('POST', `/tournaments/${id}/payouts/me/address`, { token, body: { wallet } });
  addr.json?.ok ? ok('address submitted → awaiting_payment') : bad(`address failed: ${JSON.stringify(addr.json)}`);

  // 8. host mark-paid with a bogus sig → expect on-chain verification to fail
  console.log('8. host mark-paid (bogus tx → must FAIL verification)');
  const bogus = await call('POST', `/tournaments/${id}/payouts/${myPayout?.rank ?? 1}/mark-paid`, {
    token, body: { txSig: '5'.repeat(64) },
  });
  bogus.status === 422
    ? ok(`on-chain verify correctly rejected bogus tx: "${bogus.json.error}"`)
    : bad(`expected 422, got ${bogus.status}: ${JSON.stringify(bogus.json)}`);

  console.log('\nDone. View it in the app at /tournaments/' + id + '\n');
}
main().catch((e) => console.error(e));
