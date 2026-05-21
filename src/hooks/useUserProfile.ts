'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiUserProfile } from '@/lib/api/types';

/**
 * Fetches a user's public profile by id. Pass null to skip the fetch
 * (useful when the consumer toggles between "show own profile" — read
 * straight from useAuth — and "show this other user's profile").
 *
 * Reativo per product feedback "no box Fanverse diz que a pontuação é
 * 55.124, mas no modal de Superfãs diz que estou com 55.244. Ambos
 * devem refletir exatamente o mesmo valor e ser atualizado assim que
 * o usuário pontuar":
 *
 *   1. Optimistic update no `app:points-awarded` — somatório imediato
 *      pra dar feedback de 0ms ao usuário (UX).
 *   2. Polling de 30s — garante que mesmo eventos que NÃO disparam
 *      o `app:points-awarded` (waves recebidos, cred. via socket,
 *      ajustes server-side) cheguem em janela curta.
 *   3. Refetch em `visibilitychange` → 'visible' — quando o usuário
 *      volta da aba, sincroniza imediatamente.
 *   4. `refresh()` exposto pra triggers manuais (ex.: fechar o modal
 *      de Superfãs poderia chamar pra alinhar).
 *
 * Returns { profile, loading, error, refresh }; `profile` stays null
 * até o fetch inicial resolver, depois espelha a shape da API
 * diretamente.
 */
export function useUserProfile(id: string | null): {
  profile: ApiUserProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [profile, setProfile] = useState<ApiUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref do id atual pra que callbacks (refresh, listeners) sempre
  // batam no usuário certo mesmo após troca de id sem precisar do
  // useCallback re-criar.
  const idRef = useRef(id);
  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const refresh = useCallback(async (): Promise<void> => {
    const currentId = idRef.current;
    if (!currentId) return;
    try {
      const res = await api.get<{ user: ApiUserProfile }>(
        `/api/users/${currentId}/profile`,
      );
      // Só aplica se o id ainda for o mesmo (proteção contra
      // race quando o consumer troca de usuário durante o fetch).
      if (idRef.current === currentId) setProfile(res.user);
    } catch (err) {
      console.error('useUserProfile refresh failed:', err);
    }
  }, []);

  // Initial fetch — toda vez que `id` muda. Reseta loading/error e
  // limpa profile pra evitar mostrar dados do usuário anterior.
  useEffect(() => {
    if (!id) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ user: ApiUserProfile }>(`/api/users/${id}/profile`)
      .then((res) => {
        if (!cancelled) setProfile(res.user);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('useUserProfile fetch failed:', err);
        setError(err instanceof Error ? err.message : 'fetch_failed');
        setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ── Optimistic update: app:points-awarded ──
  // Quando `awardPoints()` (src/lib/rewards.ts) dispara o evento, a
  // gente soma o amount no fanpoints localmente — feedback de 0ms.
  // O polling abaixo reconciia com o servidor depois.
  useEffect(() => {
    if (!id) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ amount: number }>).detail;
      if (!detail || typeof detail.amount !== 'number') return;
      setProfile((prev) =>
        prev ? { ...prev, fanpoints: (prev.fanpoints ?? 0) + detail.amount } : prev,
      );
    };
    window.addEventListener('app:points-awarded', handler);
    return () => window.removeEventListener('app:points-awarded', handler);
  }, [id]);

  // ── Polling de 30s ──
  // Safety net pra qualquer evento server-side (waves recebidos,
  // ajustes manuais via admin) que não dispara o CustomEvent.
  // O custo é desprezível: 1 GET /api/users/:id/profile a cada
  // 30s por tab ativa, e o endpoint é uma única query indexada.
  useEffect(() => {
    if (!id) return;
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [id, refresh]);

  // ── Visibility-change refetch ──
  // Quando o usuário volta pra aba (tabbing entre apps, dormiu
  // o laptop, etc.), sincroniza imediatamente. Sem isso, a 1ª
  // janela útil de polling poderia esperar até 30s.
  useEffect(() => {
    if (!id) return;
    const handler = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [id, refresh]);

  return { profile, loading, error, refresh };
}
