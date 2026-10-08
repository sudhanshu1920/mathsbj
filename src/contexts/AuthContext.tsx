import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { startSync, pushToCloud, clearLocalUserData } from '@/lib/sync';
import { setGuest } from '@/lib/guest';

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);
  const syncStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const stopCurrentSync = () => {
      if (syncStartTimerRef.current) {
        clearTimeout(syncStartTimerRef.current);
        syncStartTimerRef.current = null;
      }
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      syncUserIdRef.current = null;
    };

    const startUserSync = (nextUser: User | null) => {
      if (
        nextUser &&
        syncUserIdRef.current === nextUser.id &&
        (cleanupRef.current || syncStartTimerRef.current)
      ) {
        return;
      }

      stopCurrentSync();
      if (!nextUser) return;

      syncUserIdRef.current = nextUser.id;
      const userId = nextUser.id;
      syncStartTimerRef.current = setTimeout(() => {
        syncStartTimerRef.current = null;
        if (syncUserIdRef.current === userId) {
          cleanupRef.current = startSync(userId);
        }
      }, 0);
    };

    if (!supabase) {
      setSession(null);
      setUser(null);
      setGuest(true);
      setLoading(false);
      return () => stopCurrentSync();
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setGuest(!s?.user);
      startUserSync(s?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setGuest(!s?.user);
      setLoading(false);
      startUserSync(s?.user ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
      stopCurrentSync();
    };
  }, []);

  const signOut = async () => {
    if (user && supabase) {
      try { await pushToCloud(user.id); } catch { /* ignore */ }
    }
    if (syncStartTimerRef.current) {
      clearTimeout(syncStartTimerRef.current);
      syncStartTimerRef.current = null;
    }
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    syncUserIdRef.current = null;
    if (supabase) await supabase.auth.signOut();
    clearLocalUserData();
    setGuest(false);
  };

  return <Ctx.Provider value={{ user, session, loading, signOut }}>{children}</Ctx.Provider>;
}
