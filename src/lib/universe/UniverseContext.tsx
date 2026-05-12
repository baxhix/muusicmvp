'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { UNIVERSES, getUniverse, type UniverseConfig } from './universes';

const STORAGE_KEY = 'muusic:universe';

interface UniverseContextValue {
  /** Currently selected universe id, or null until the user picks. */
  universeId: string | null;
  /** Full config for the active universe (null if none chosen). */
  config: UniverseConfig | null;
  /** `true` once the localStorage read has resolved — gates redirects
   * so we don't bounce to /select before knowing the user already
   * picked something. */
  hydrated: boolean;
  /** Persist a new selection (writes to localStorage + state). */
  setUniverse: (id: string) => void;
  /** Forget the current selection — used by "trocar universo". */
  clearUniverse: () => void;
}

const UniverseContext = createContext<UniverseContextValue | null>(null);

export function UniverseProvider({ children }: { children: ReactNode }) {
  const [universeId, setUniverseId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted choice once after mount (localStorage is client-only,
  // so SSR can't see it — we wait for client hydration then read).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && UNIVERSES[stored]) setUniverseId(stored);
    } catch {
      // localStorage can throw in some private-mode scenarios — ignore;
      // we'll just behave as if no universe is selected yet.
    }
    setHydrated(true);
  }, []);

  const setUniverse = useCallback((id: string) => {
    if (!UNIVERSES[id]) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    setUniverseId(id);
  }, []);

  const clearUniverse = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setUniverseId(null);
  }, []);

  const config = useMemo(() => getUniverse(universeId), [universeId]);

  const value = useMemo<UniverseContextValue>(
    () => ({ universeId, config, hydrated, setUniverse, clearUniverse }),
    [universeId, config, hydrated, setUniverse, clearUniverse],
  );

  return (
    <UniverseContext.Provider value={value}>
      {children}
    </UniverseContext.Provider>
  );
}

export function useUniverse(): UniverseContextValue {
  const ctx = useContext(UniverseContext);
  if (!ctx) {
    throw new Error('useUniverse must be used inside <UniverseProvider>');
  }
  return ctx;
}
