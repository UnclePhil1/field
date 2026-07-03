// username-auth — register or log in with a username + password. Maps the
// username to a synthetic email internally so Supabase auth handles the password.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { admin } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const emailFor = (username: string) => `${username.toLowerCase()}@field.app`;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: { action?: string; username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const { action, username, password } = body;
  if (!username || !USERNAME_RE.test(username)) {
    return json({ error: 'Username must be 3–20 letters, numbers or underscores.' }, 400);
  }
  if (!password || password.length < 6) {
    return json({ error: 'Password must be at least 6 characters.' }, 400);
  }

  const db = admin();
  const email = emailFor(username);
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === 'register') {
    // username must be free
    const { data: taken } = await db.from('profiles').select('id').ilike('username', username).maybeSingle();
    if (taken) return json({ error: 'That username is taken.' }, 409);

    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (createErr || !created.user) {
      const msg = /already/i.test(createErr?.message ?? '') ? 'That username is taken.' : createErr?.message;
      return json({ error: msg ?? 'Could not create account' }, 409);
    }
    const { error: profErr } = await db.from('profiles').insert({ id: created.user.id, username });
    if (profErr) {
      await db.auth.admin.deleteUser(created.user.id); // rollback
      return json({ error: profErr.code === '23505' ? 'That username is taken.' : profErr.message }, 409);
    }
    const { data: signIn, error: signErr } = await authClient.auth.signInWithPassword({ email, password });
    if (signErr || !signIn.session) return json({ error: 'Signed up, but sign-in failed.' }, 500);
    return json({ session: signIn.session, profile: { username, wallet: null } });
  }

  if (action === 'login') {
    const { data: signIn, error: signErr } = await authClient.auth.signInWithPassword({ email, password });
    if (signErr || !signIn.session) return json({ error: 'Invalid username or password.' }, 401);
    const { data: prof } = await db.from('profiles').select('username, wallet').eq('id', signIn.session.user.id).maybeSingle();
    return json({ session: signIn.session, profile: prof ?? { username, wallet: null } });
  }

  return json({ error: 'unknown action' }, 400);
});
