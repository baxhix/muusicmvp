'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '@/lib/api/client';
import type { ApiUser } from '@/lib/api/types';

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  /** Re-fetch /api/auth/me. Call after login or profile edits. */
  refresh: () => Promise<void>;
  /** Send magic link to the given email. Returns true on accepted (200). */
  requestMagicLink: (email: string) => Promise<boolean>;
  /** Sign out: clears the session cookie + DB row, redirects to /auth. */
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: ApiUser }>('/api/auth/me');
      setUser(res.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        // Network error: keep previous user state, but don't loop.
        console.error('auth refresh failed:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestMagicLink = useCallback(async (email: string) => {
    try {
      await api.post<{ ok: true }>('/api/auth/request', { email });
      return true;
    } catch (err) {
      console.error('magic link request failed:', err);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('logout failed:', err);
    }
    setUser(null);
    // Hard navigation drops in-memory state (socket, hooks) cleanly.
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, refresh, requestMagicLink, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
