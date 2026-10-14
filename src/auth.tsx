import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session as AuthSession } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearCaches } from './lib/api';

interface AuthState {
  session: AuthSession | null;
  loading: boolean;
  /** True after the user arrives from a password-reset email link. */
  recovering: boolean;
  setRecovering: (v: boolean) => void;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true, recovering: false, setRecovering: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') clearCaches();
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading, recovering, setRecovering }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
