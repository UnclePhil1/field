import nacl from 'npm:tweetnacl@1.0.3';
import bs58 from 'npm:bs58@5.0.0';
import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';

function verifySignature(wallet: string, message: string, signature: string): boolean {
  try {
    const pub = bs58.decode(wallet);
    const msg = new TextEncoder().encode(message);
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

  const user = await getUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { wallet, message, signature } = await req.json().catch(() => ({}));
  if (!wallet || !message || !signature) return json({ error: 'wallet, message and signature required' }, 400);
  if (!verifySignature(wallet, message, signature)) return json({ error: 'signature verification failed' }, 401);

  const db = admin();
  const { data: existing } = await db.from('profiles').select('id').eq('wallet', wallet).maybeSingle();
  if (existing && existing.id !== user.id) {
    return json({ error: 'That wallet is already linked to another account.' }, 409);
  }

  const { error } = await db.from('profiles').update({ wallet }).eq('id', user.id);
  if (error) {
    return json({ error: error.code === '23505' ? 'That wallet is already linked to another account.' : error.message }, 409);
  }
  return json({ ok: true, wallet });
});
