import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase, callFunction } from '../lib/supabase';
import { fetchRecentCalls } from '../lib/api';
import { useAuth } from './AuthStore';
import type { PredictionPick, SettledCall } from '../types';

const STREAK_STEP = 0.1; // +10% per streak rung (mirrors server scoring)

interface AppStoreValue {
  coins: number;
  streak: number;
  /** streak bonus multiplier, derived from streak */
  multiplier: number;
  activeMatchId: string | null;
  recentCalls: SettledCall[];
  setActiveMatch: (id: string | null) => void;
  /** Server-authoritative: records the wager. Settlement happens in the engine. */
  placeCall: (input: { cardId: string; pick: PredictionPick; stake: number }) => Promise<void>;
  refreshRecentCalls: () => Promise<void>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [coins, setCoins] = useState(0);
  const [streak, setStreak] = useState(0);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [recentCalls, setRecentCalls] = useState<SettledCall[]>([]);

  const multiplier = useMemo(() => +(1 + streak * STREAK_STEP).toFixed(1), [streak]);

  const refreshRecentCalls = useCallback(async () => {
    if (!userId) {
      setRecentCalls([]);
      return;
    }
    try {
      setRecentCalls(await fetchRecentCalls());
    } catch {
      /* leave previous list on transient error */
    }
  }, [userId]);

  // Load + live-subscribe the player's profile (coins, streak) and settlements.
  useEffect(() => {
    if (!userId) {
      setCoins(0);
      setStreak(0);
      setRecentCalls([]);
      return;
    }

    let active = true;
    supabase
      .from('profiles')
      .select('coins, streak')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setCoins(data.coins);
        setStreak(data.streak);
      });
    refreshRecentCalls();

    const channel = supabase
      .channel(`me:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { coins: number; streak: number };
          setCoins(row.coins);
          setStreak(row.streak);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements', filter: `user_id=eq.${userId}` },
        () => refreshRecentCalls(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, refreshRecentCalls]);

  const placeCall = useCallback(
    async (input: { cardId: string; pick: PredictionPick; stake: number }) => {
      await callFunction('place-call', input);
    },
    [],
  );

  const value = useMemo<AppStoreValue>(
    () => ({
      coins,
      streak,
      multiplier,
      activeMatchId,
      recentCalls,
      setActiveMatch: setActiveMatchId,
      placeCall,
      refreshRecentCalls,
    }),
    [coins, streak, multiplier, activeMatchId, recentCalls, placeCall, refreshRecentCalls],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within <AppStoreProvider>');
  return ctx;
}
