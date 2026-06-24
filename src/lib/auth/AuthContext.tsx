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
import { clearOnboarding } from '@/lib/auth/onboardingStore';

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

/* Rotas privadas que exigem usuário autenticado. Quando o
 * /api/auth/me retorna 401 mid-session ESTANDO numa dessas
 * rotas, o AuthContext força redirect pra /auth?expired=1 em
 * vez de só zerar o `user` (que fazia a UI ficar num estado
 * "fantasma" — email vazio, sem foto, 0 fanpoints — em vez de
 * uma tela clara de logout). */
const PRIVATE_ROUTE_PREFIXES = ['/app', '/admin'] as const;

function isOnPrivateRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return PRIVATE_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  /* Marca se a sessão JÁ chegou a estar autenticada nesta page
   * load. Sem isso, um 401 no PRIMEIRO /api/auth/me (visitante
   * anônimo em /app, ainda não logado) também redirecionaria,
   * criando loop pra quem só queria visitar a landing. */
  const [wasAuthed, setWasAuthed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: ApiUser }>('/api/auth/me');
      setUser(res.user);
      setWasAuthed(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        /* Qualquer 401 numa rota privada (/app, /admin) redireciona
         * pro /auth — inclusive no PRIMEIRO load (visitante anônimo
         * que abre /app direto, ex.: aba anônima num deep-link). Sem
         * isso o shell logado (vazio) ficava acessível sem sessão.
         * `/auth` não é rota privada, então não há loop.
         *   - wasAuthed (sessão expirou no meio) → ?expired=1 ("sua
         *     sessão expirou").
         *   - anônimo (nunca logou) → /auth puro (tela de login). */
        if (isOnPrivateRoute() && typeof window !== 'undefined') {
          const target = wasAuthed ? '/auth?expired=1' : '/auth';
          if (window.location.pathname + window.location.search !== target) {
            window.location.href = target;
          }
        }
      } else {
        // Network error: keep previous user state, but don't loop.
        console.error('auth refresh failed:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [wasAuthed]);

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
    // Limpa o onboardingStore — sem isso, o /auth ao reload
    // detectava um step antigo (birth-date/profile/etc) e
    // tentava redirecionar pra ele. Como a página não tem
    // sessão, ela bounceava de volta pra /auth → loop
    // infinito (tela "tremendo").
    clearOnboarding();
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
