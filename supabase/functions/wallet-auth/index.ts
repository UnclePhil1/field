// wallet-auth — verify a Solana wallet signature and return a Supabase session.
//
// Flow: the browser connects a wallet, signs a login message, and POSTs
// { wallet, message, signature }. We verify the signature with tweetnacl, then
// map the wallet to a deterministic Supabase auth user (creating it on first
// sight) and return a real session. The wallet IS the account.
import nacl from 'npm:tweetnacl@1.0.3';
import bs58 from 'npm:bs58@5.0.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { admin } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
// Server secret used to derive each wallet's Supabase password. Set as a secret.
const AUTH_SECRET = Deno.env.get('WALLET_AUTH_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function walletEmail(wallet: string) {
  return `${wallet.toLowerCase()}@field.wallet`;
}

// Deterministic password = HMAC-SHA256(AUTH_SECRET, wallet). Stable per wallet,
// never leaves the server, lets us mint a session via signInWithPassword.
async function walletPassword(wallet: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(wallet));
  return bs58.encode(new Uint8Array(sig));
}

function verifySignature(wallet: string, message: string, signature: string): boolean {
  try {
    const pub = bs58.decode(wallet);
    const msg = new TextEncoder().encode(message);
    // accept base58 or base64 signatures
    let sig: Uint8Array;
    try {
      sig = bs58.decode(signature);
    } catch {
      sig = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    }
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let payload: { wallet?: string; message?: string; signature?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const { wallet, message, signature } = payload;
  if (!wallet || !message || !signature) {
    return json({ error: 'wallet, message and signature are required' }, 400);
  }
  if (!verifySignature(wallet, message, signature)) {
    return json({ error: 'signature verification failed' }, 401);
  }

  const db = admin();
  const email = walletEmail(wallet);
  const password = await walletPassword(wallet);

  // Look up existing profile → user. Create the auth user on first login.
  const { data: existing } = await db.from('profiles').select('id, username').eq('wallet', wallet).maybeSingle();

  if (!existing) {
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { wallet },
    });
    if (createErr || !created.user) {
      return json({ error: `could not create user: ${createErr?.message}` }, 500);
    }
    const { error: profErr } = await db.from('profiles').insert({ id: created.user.id, wallet });
    if (profErr) return json({ error: `could not create profile: ${profErr.message}` }, 500);
  }

  // Mint a session with the anon client (returns access + refresh tokens).
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signIn, error: signErr } = await authClient.auth.signInWithPassword({ email, password });
  if (signErr || !signIn.session) {
    return json({ error: `sign-in failed: ${signErr?.message}` }, 500);
  }

  return json({
    session: signIn.session,
    profile: { username: existing?.username ?? null, wallet },
  });
});
