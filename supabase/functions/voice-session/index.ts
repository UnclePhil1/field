import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';
import { verifyUsdcPayment } from '../_shared/solana.ts';

const XAI_API_KEY = Deno.env.get('XAI_API_KEY') ?? '';
const TREASURY = Deno.env.get('VOICE_TREASURY_WALLET') ?? '';
const FREE_TRIALS = 5;
const PRICE_USDC = 5;
const SUB_DAYS = 30;

// deno-lint-ignore no-explicit-any
async function accessFor(db: any, userId: string) {
  const { data } = await db.from('voice_access').select('*').eq('user_id', userId).maybeSingle();
  const trialsUsed = data?.trials_used ?? 0;
  const subActive = !!data?.sub_expires_at && new Date(data.sub_expires_at).getTime() > Date.now();
  return {
    trialsUsed,
    trialsLeft: Math.max(0, FREE_TRIALS - trialsUsed),
    subActive,
    subExpiresAt: data?.sub_expires_at ?? null,
    priceUsdc: PRICE_USDC,
    treasury: TREASURY || null,
  };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (!XAI_API_KEY) return json({ error: 'voice agent not configured' }, 503);

  const user = await getUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const db = admin();
  const path = new URL(req.url).pathname;

  if (req.method === 'GET') {
    return json(await accessFor(db, user.id));
  }

  if (req.method === 'POST' && path.endsWith('/subscribe')) {
    if (!TREASURY) return json({ error: 'subscriptions are not open yet' }, 503);
    const { txSig } = await req.json().catch(() => ({}));
    if (!txSig || !/^[1-9A-HJ-NP-Za-km-z]{60,120}$/.test(String(txSig))) {
      return json({ error: 'a valid transaction signature is required' }, 400);
    }
    const { data: dup } = await db.from('voice_access').select('user_id').eq('sub_tx_sig', txSig).maybeSingle();
    if (dup) return json({ error: 'this payment was already used' }, 409);
    const check = await verifyUsdcPayment(String(txSig), TREASURY, PRICE_USDC);
    if (!check.verified) return json({ error: check.reason ?? 'payment could not be verified' }, 422);
    const expires = new Date(Date.now() + SUB_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.from('voice_access').upsert({
      user_id: user.id, sub_expires_at: expires, sub_tx_sig: String(txSig), updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    return json({ ok: true, subExpiresAt: expires });
  }

  if (req.method === 'POST') {
    const access = await accessFor(db, user.id);
    if (!access.subActive) {
      if (access.trialsLeft <= 0) {
        return json({ error: 'free trials used up', locked: true, ...access }, 402);
      }
      await db.from('voice_access').upsert({
        user_id: user.id, trials_used: access.trialsUsed + 1, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    const res = await fetch('https://api.x.ai/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: body?.error ?? `token mint failed (${res.status})` }, 502);
    const token = body.value ?? body.client_secret?.value ?? body.token;
    if (!token || typeof token !== 'string') return json({ error: 'unexpected token response' }, 502);
    const after = await accessFor(db, user.id);
    return json({ token, ...after });
  }

  return json({ error: 'not found' }, 404);
});
