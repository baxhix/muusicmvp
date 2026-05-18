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

/** Universe a fresh visitor lands on when nothing has been
 *  persisted yet. The Ana Castela / Countrybeat picker page
 *  was retired per product feedback, so we just auto-select
 *  Ana Castela on first visit — users who want to "trocar
 *  universo" later still have the (commented-out) entry-point
 *  in the TopBar drawer to surface again. */
const DEFAULT_UNIVERSE_ID = 'ana-castela';

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
  // SSR-safe initial state: stays `null` for the first render so
  // the server HTML doesn't claim an artist before hydration.
  // The effect below snaps to the persisted value (or
  // DEFAULT_UNIVERSE_ID) after mount.
  const [universeId, setUniverseId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted choice once after mount; fall back to the
  // default universe when nothing is stored so users never see
  // an empty / unconfigured shell. (The /app/select picker page
  // was retired per product feedback — this default is how the
  // app now skips it.)
  useEffect(() => {
    let initial = DEFAULT_UNIVERSE_ID;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && UNIVERSES[stored]) initial = stored;
    } catch {
      // localStorage can throw in some private-mode scenarios.
      // Fall through with the default.
    }
    setUniverseId(initial);
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
