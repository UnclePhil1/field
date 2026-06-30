import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, callFunction } from '../lib/supabase';
import { connectAndSign, disconnectWallet } from '../lib/wallet';

/**
 * Auth lifecycle, backed by a real Supabase session:
 *   guest → (connect + sign) → needs-username → (set username) → ready
 *
 * The wallet signs a login message that the `wallet-auth` Edge Function
 * verifies before issuing the session. The session is persisted by supabase-js.
 */
export type AuthStatus = 'loading' | 'guest' | 'needs-username' | 'ready';

interface AuthValue {
  status: AuthStatus;
  userId: string | null;
  wallet: string | null;
  username: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  setUsername: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [username, setUsernameState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load a profile row for the signed-in user.
  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('wallet, username')
      .eq('id', userId)
      .maybeSingle();
    setWallet(data?.wallet ?? null);
    setUsernameState(data?.username ?? null);
  }, []);

  // Hydrate from any persisted session, then track auth changes.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id);
      else {
        setWallet(null);
        setUsernameState(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const signed = await connectAndSign();
      const { session: newSession, profile } = await callFunction<{
        session: Session;
        profile: { username: string | null; wallet: string };
      }>('wallet-auth', signed);
      await supabase.auth.setSession({
        access_token: newSession.access_token,
        refresh_token: newSession.refresh_token,
      });
      setSession(newSession);
      setWallet(profile.wallet);
      setUsernameState(profile.username);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect wallet');
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  const setUsername = useCallback(
    async (name: string) => {
      if (!session) throw new Error('Not signed in');
      const trimmed = name.trim();
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ username: trimmed })
        .eq('id', session.user.id);
      if (upErr) {
        const msg = upErr.code === '23505' ? 'That username is taken.' : upErr.message;
        setError(msg);
        throw new Error(msg);
      }
      setUsernameState(trimmed);
    },
    [session],
  );

  const signOut = useCallback(async () => {
    await disconnectWallet();
    await supabase.auth.signOut();
    setSession(null);
    setWallet(null);
    setUsernameState(null);
  }, []);

  const status: AuthStatus = loading
    ? 'loading'
    : !session
      ? 'guest'
      : !username
        ? 'needs-username'
        : 'ready';

  const value = useMemo<AuthValue>(
    () => ({
      status,
      userId: session?.user.id ?? null,
      wallet,
      username,
      connecting,
      error,
      connect,
      setUsername,
      signOut,
    }),
    [status, session, wallet, username, connecting, error, connect, setUsername, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
