import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, SUPABASE_CONFIGURED } from '@/integrations/supabase/client';
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

  useEffect(() => {
    // Native/CI builds without Supabase environment values must remain fully
    // usable in guest/offline mode instead of blocking or crashing at startup.
    if (!SUPABASE_CONFIGURED) {
      setLoading(false);
      return;
    }

    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);

      // Tear down previous sync
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }

      if (s?.user) {
        // Signed in: leave guest mode if it was active
        setGuest(false);
        // Defer to avoid deadlocks in the auth callback
        setTimeout(() => {
          cleanupRef.current = startSync(s.user.id);
        }, 0);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user && !cleanupRef.current) {
        cleanupRef.current = startSync(s.user.id);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  const signOut = async () => {
    if (user) { try { await pushToCloud(user.id); } catch { /* ignore */ } }
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    await supabase.auth.signOut();
    clearLocalUserData();
    setGuest(false);
  };

  return <Ctx.Provider value={{ user, session, loading, signOut }}>{children}</Ctx.Provider>;
}