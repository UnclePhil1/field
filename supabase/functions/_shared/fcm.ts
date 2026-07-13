import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let cachedToken: { token: string; exp: number } | null = null;

export const fcmEnabled = !!Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

// deno-lint-ignore no-explicit-any
export async function prefAllows(db: SupabaseClient, userId: string, check: (p: any) => boolean): Promise<boolean> {
  const { data } = await db.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return true;
  if (data.enabled === false) return false;
  return check(data);
}

function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })));
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)));
  const jwt = `${signingInput}.${b64url(sig)}`;
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`oauth failed: ${JSON.stringify(body)}`);
  cachedToken = { token: body.access_token, exp: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

export async function notifyUser(db: SupabaseClient, userId: string, payload: PushPayload): Promise<void> {
  const sa = serviceAccount();
  if (!sa) return; // not configured → no-op
  const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', userId);
  if (!tokens?.length) return;

  const token = await accessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  for (const row of tokens) {
    const message = {
      message: {
        token: row.token,
        notification: { title: payload.title, body: payload.body },
        webpush: {
          fcmOptions: { link: payload.url ?? '/' },
          notification: { icon: '/logo.png', badge: '/logo.png', tag: payload.tag },
        },
        data: { url: payload.url ?? '/', ...(payload.tag ? { tag: payload.tag } : {}) },
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (res.status === 404 || res.status === 400) {
      const err = await res.json().catch(() => ({}));
      const code = err?.error?.details?.[0]?.errorCode ?? err?.error?.status;
      if (code === 'UNREGISTERED' || res.status === 404) {
        await db.from('push_tokens').delete().eq('token', row.token);
      }
    }
  }
}
