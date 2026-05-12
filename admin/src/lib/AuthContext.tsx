'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { logout as serverLogout, type MuusicUser } from './auth';

/**
 * Lightweight admin auth context. Populated by AdminAuthGate after a
 * successful /api/auth/me check, consumed by the sidebar (profile
 * footer), topbar (future avatar menu) and anywhere else that needs
 * "who is logged in" without re-doing the network round-trip.
 *
 * The shape stays narrow on purpose — heavier auth state (tokens,
 * refresh logic, etc.) belongs in /lib/auth.ts and stays out of
 * React's render path.
 */
interface AuthContextValue {
  user: MuusicUser;
  /**
   * Sign out: invalidates the session server-side then triggers a full
   * page reload so AdminAuthGate re-mounts and lands the user on the
   * sign-in card. Reload (instead of a soft state flip) guarantees
   * every cached fetch / hook tied to the previous identity is
   * discarded — no risk of stale data leaking into the next session.
   */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: MuusicUser;
  children: ReactNode;
}) {
  const logout = useCallback(async () => {
    await serverLogout();
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, logout }),
    [user, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook for components inside the admin shell. Throws if used outside
 * an AuthProvider — that's a programmer error (the shell layout always
 * wraps children once auth resolves) so failing loudly beats a silent
 * undefined-user render.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return ctx;
}
