'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

/* ============================================================
 * BRAINSTORM FLAGS
 *
 * Client-side feature toggles for experimental UI we want to
 * preview without committing to. Each flag is a single boolean
 * the team can flip live (via the lightbulb trigger on /app)
 * to show / hide a feature for stakeholder approval.
 *
 * Visibility is GATED to the brainstorm-owner email — non-owner
 * users always see `false` for every flag regardless of what's
 * in their localStorage. This means every consumer of
 * `useBrainstormFlags` (the lightbulb panel, SuperliveTrigger,
 * CollectiveListeningTrigger, the AnaFlight scheduler in
 * AppShellContext) automatically unmounts for everyone except
 * the owner. The persisted localStorage values still survive
 * for the owner's device — flipping toggles in the panel updates
 * the owner's view in real time as before.
 *
 * To add a new experimental feature:
 *   1. Add a key to `BrainstormFlagKey` below.
 *   2. Pick a default in `DEFAULTS` (true = visible by default).
 *   3. Add a descriptor entry to `FLAG_DESCRIPTORS`.
 *   4. Read the flag wherever the feature renders / publishes.
 * ============================================================ */

/** Email of the only user allowed to see + control brainstorm
 *  features. Exported so any consumer can apply the same gate
 *  if needed; the most common path is to just call
 *  `useBrainstormFlags()`, which already enforces this. */
export const BRAINSTORM_OWNER_EMAIL = 'demari.lets@gmail.com';

/** All known experimental-feature keys. */
export type BrainstormFlagKey = 'anaFlight' | 'superlive' | 'collectiveListening';

export type BrainstormFlags = Record<BrainstormFlagKey, boolean>;

/** Default state for every flag. Setting a default to `true`
 *  means the feature shows up immediately on a fresh device;
 *  `false` means the client has to flip the toggle on first.
 *  Keep defaults aligned with how we want a brand-new viewer
 *  to land on /app. */
const DEFAULTS: BrainstormFlags = {
  anaFlight: true,
  superlive: true,
  collectiveListening: true,
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
  {
    key: 'superlive',
    title: 'Superlive ao vivo',
    description:
      'Pílula "AO VIVO" no topo da home que abre um modal com a transmissão da Ana e o chat dos fãs em tempo real.',
  },
  {
    key: 'collectiveListening',
    title: 'Audição coletiva (Fire Arena)',
    description:
      'Botão da Fire Arena que abre uma sessão de escuta colaborativa do álbum "Let\'s Go Rodeo" — vinil girando, capa do álbum e chat dos fãs comentando em tempo real.',
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

/** All-false flag snapshot returned to non-owner users so every
 *  brainstorm consumer effectively unmounts for them. */
const ALL_OFF: BrainstormFlags = Object.fromEntries(
  Object.keys(DEFAULTS).map((k) => [k, false]),
) as BrainstormFlags;

/**
 * React hook — returns the current flags plus a setter for any
 * single key. Subscribes to the CHANGE_EVENT so a flip in one
 * component (e.g. the BrainstormPanel) immediately re-renders
 * every other consumer (e.g. AppShellProvider's flight scheduler).
 *
 * GATED: when the authenticated user's email does NOT match
 * `BRAINSTORM_OWNER_EMAIL`, the hook returns an all-false
 * snapshot + a no-op setter. The localStorage read is skipped
 * entirely so a non-owner device with stale persisted flags
 * still sees nothing. This is the single chokepoint that hides
 * every brainstorm feature for everyone except the owner.
 *
 * SSR-safe: initial render uses DEFAULTS so the server HTML
 * matches the client's first paint. The effect snaps to the
 * persisted value (or to ALL_OFF for non-owners) right after
 * hydration.
 */
export function useBrainstormFlags(): {
  flags: BrainstormFlags;
  setFlag: (key: BrainstormFlagKey, value: boolean) => void;
} {
  const { user } = useAuth();
  const isOwner =
    user?.email?.trim().toLowerCase() === BRAINSTORM_OWNER_EMAIL;

  const [flags, setFlags] = useState<BrainstormFlags>(() => ({ ...DEFAULTS }));

  useEffect(() => {
    // Non-owner — force every brainstorm flag off and skip the
    // localStorage / event subscription entirely. They literally
    // cannot turn anything on, regardless of what's persisted
    // on their device.
    if (!isOwner) {
      setFlags(ALL_OFF);
      return;
    }
    setFlags(readBrainstormFlags());
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<BrainstormFlags>;
      if (ce.detail) setFlags(ce.detail);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [isOwner]);

  const setFlag = (key: BrainstormFlagKey, value: boolean) => {
    // No-op for non-owners — keeps the API surface stable even
    // when the gate is closed, so callers don't need their own
    // branching.
    if (!isOwner) return;
    writeBrainstormFlags({ [key]: value });
  };

  return { flags, setFlag };
}
