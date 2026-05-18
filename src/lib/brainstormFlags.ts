'use client';

import { useEffect, useState } from 'react';

/* ============================================================
 * BRAINSTORM FLAGS
 *
 * Client-side feature toggles for experimental UI we want to
 * preview without committing to. Each flag is a single boolean
 * the team can flip live (via the lightbulb trigger on /app)
 * to show / hide a feature for stakeholder approval.
 *
 * These are NOT a real feature-flag service — no per-user
 * targeting, no remote evaluation. They live in localStorage
 * so each device's preference is sticky across sessions, and
 * a CustomEvent bridges across components on the same tab so
 * a flag flip is reflected everywhere without a route refresh.
 *
 * To add a new experimental feature:
 *   1. Add a key to `BrainstormFlagKey` below.
 *   2. Pick a default in `DEFAULTS` (true = visible by default).
 *   3. Add a descriptor entry to `FLAG_DESCRIPTORS`.
 *   4. Read the flag wherever the feature renders / publishes.
 * ============================================================ */

/** All known experimental-feature keys. */
export type BrainstormFlagKey = 'anaFlight';

export type BrainstormFlags = Record<BrainstormFlagKey, boolean>;

/** Default state for every flag. Setting a default to `true`
 *  means the feature shows up immediately on a fresh device;
 *  `false` means the client has to flip the toggle on first.
 *  Keep defaults aligned with how we want a brand-new viewer
 *  to land on /app. */
const DEFAULTS: BrainstormFlags = {
  anaFlight: true,
};

/**
 * UI-facing descriptor for each flag — used by the
 * BrainstormPanel to render the toggle list. Keep `title`
 * short so the panel stays narrow; the `description` line
 * is where we can lean into context.
 */
export interface FlagDescriptor {
  key: BrainstormFlagKey;
  title: string;
  description: string;
}

export const FLAG_DESCRIPTORS: readonly FlagDescriptor[] = [
  {
    key: 'anaFlight',
    title: 'Tour Portugal (Ana voando)',
    description:
      'Linha animada de Londrina até Lisboa com um avião percorrendo o caminho em tempo real. Toque no avião para mandar mensagem.',
  },
];

const STORAGE_KEY = 'muusic.brainstormFlags.v1';
const CHANGE_EVENT = 'muusic:brainstorm-flags-changed';

/** Read the current persisted flags + merge with defaults. SSR
 *  -safe: returns defaults when window is unavailable. */
export function readBrainstormFlags(): BrainstormFlags {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<BrainstormFlags>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Persist a partial update + broadcast a CustomEvent so every
 *  `useBrainstormFlags()` subscriber on the page re-reads. */
export function writeBrainstormFlags(patch: Partial<BrainstormFlags>): void {
  if (typeof window === 'undefined') return;
  const current = readBrainstormFlags();
  const next = { ...current, ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full / private browsing — broadcast anyway so the
    // current session reflects the toggle even if it won't persist.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
}

/**
 * React hook — returns the current flags plus a setter for any
 * single key. Subscribes to the CHANGE_EVENT so a flip in one
 * component (e.g. the BrainstormPanel) immediately re-renders
 * every other consumer (e.g. AppShellProvider's flight scheduler).
 *
 * SSR-safe: initial render uses DEFAULTS so the server HTML
 * matches the client's first paint. The effect snaps to the
 * persisted value right after hydration. Components that need
 * the persisted value on the FIRST tick (rare) should call
 * `readBrainstormFlags()` inside their own effect.
 */
export function useBrainstormFlags(): {
  flags: BrainstormFlags;
  setFlag: (key: BrainstormFlagKey, value: boolean) => void;
} {
  const [flags, setFlags] = useState<BrainstormFlags>(() => ({ ...DEFAULTS }));

  useEffect(() => {
    setFlags(readBrainstormFlags());
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<BrainstormFlags>;
      if (ce.detail) setFlags(ce.detail);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const setFlag = (key: BrainstormFlagKey, value: boolean) => {
    writeBrainstormFlags({ [key]: value });
  };

  return { flags, setFlag };
}
