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
import type { WalletSignIn } from '../lib/wallet';

/**
 * Dual auth: a user may sign in with a WALLET or a USERNAME + password, and link
 * the other later on their profile. A valid Supabase session === ready; there is
 * no forced username step (wallet-only accounts display a shortened address).
 */
export type AuthStatus = 'loading' | 'guest' | 'ready';

interface ProfileResp {
  session: Session;
  profile: { username: string | null; wallet: string | null };
}

interface AuthValue {
  status: AuthStatus;
  userId: string | null;
  wallet: string | null;
  username: string | null;
  connecting: boolean;
  error: string | null;
  /** wallet register/login (signed message → wallet-auth) */
  authenticateWallet: (signed: WalletSignIn) => Promise<void>;
  registerUsername: (username: string, password: string) => Promise<void>;
  loginUsername: (username: string, password: string) => Promise<void>;
  /** link a verified wallet to the current account */
  linkWallet: (signed: WalletSignIn) => Promise<void>;
  /** add/change the username on the current account */
  setUsername: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [username, setUsernameState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('wallet, username').eq('id', userId).maybeSingle();
    setWallet(data?.wallet ?? null);
    setUsernameState(data?.username ?? null);
  }, []);

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

  // Common: apply a session returned by an auth Edge Function.
  const applySession = useCallback(async (resp: ProfileResp) => {
    await supabase.auth.setSession({
      access_token: resp.session.access_token,
      refresh_token: resp.session.refresh_token,
    });
    setSession(resp.session);
    setWallet(resp.profile.wallet);
    setUsernameState(resp.profile.username);
  }, []);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setConnecting(true);
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
        throw e;
      } finally {
        setConnecting(false);
      }
    },
    [],
  );

  const authenticateWallet = useCallback(
    (signed: WalletSignIn) => run(async () => applySession(await callFunction<ProfileResp>('wallet-auth', signed))),
    [run, applySession],
  );

  const registerUsername = useCallback(
    (u: string, password: string) =>
      run(async () => applySession(await callFunction<ProfileResp>('username-auth', { action: 'register', username: u, password }))),
    [run, applySession],
  );

  const loginUsername = useCallback(
    (u: string, password: string) =>
      run(async () => applySession(await callFunction<ProfileResp>('username-auth', { action: 'login', username: u, password }))),
    [run, applySession],
  );

  const linkWallet = useCallback(
    (signed: WalletSignIn) =>
      run(async () => {
        await callFunction('link-wallet', signed);
        setWallet(signed.wallet);
      }),
    [run],
  );

  const setUsername = useCallback(
    async (name: string) => {
      if (!session) throw new Error('Not signed in');
      const trimmed = name.trim();
      const { error: upErr } = await supabase.from('profiles').update({ username: trimmed }).eq('id', session.user.id);
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
    await supabase.auth.signOut();
    setSession(null);
    setWallet(null);
    setUsernameState(null);
  }, []);

  const status: AuthStatus = loading ? 'loading' : session ? 'ready' : 'guest';

  const value = useMemo<AuthValue>(
    () => ({
      status,
      userId: session?.user.id ?? null,
      wallet,
      username,
      connecting,
      error,
      authenticateWallet,
      registerUsername,
      loginUsername,
      linkWallet,
      setUsername,
      signOut,
      clearError: () => setError(null),
    }),
    [status, session, wallet, username, connecting, error, authenticateWallet, registerUsername, loginUsername, linkWallet, setUsername, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
