// Supabase clients for Edge Functions.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

/** Service-role client — bypasses RLS. Use for all gameplay writes. */
export function admin(): SupabaseClient {
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Resolve the authenticated user from the request's Authorization bearer.
 * Returns null if there is no valid session.
 */
export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
