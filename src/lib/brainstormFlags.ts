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

/** Email of the primary brainstorm owner — kept exported for any
 *  legacy consumer that still imports it (back-compat). The actual
 *  allowlist lives in `BRAINSTORM_ALLOWED_EMAILS` below; new code
 *  should reference `isBrainstormOwner(email)` instead of comparing
 *  to this constant directly. */
export const BRAINSTORM_OWNER_EMAIL = 'demari.lets@gmail.com';

/** Allowlist of emails that can see + control brainstorm features
 *  (lightbulb panel, experimental triggers, etc.). All lowercase —
 *  the comparison normalizes the user's email before checking.
 *
 *  Add stakeholders here when product wants them to preview a
 *  feature live before it's rolled out to everyone. */
export const BRAINSTORM_ALLOWED_EMAILS: readonly string[] = [
  BRAINSTORM_OWNER_EMAIL,
  'raphasoareslr@gmail.com',
];

/** Case-insensitive membership check against the allowlist. */
export function isBrainstormOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BRAINSTORM_ALLOWED_EMAILS.some((e) => e.toLowerCase() === normalized);
}

/** All known experimental-feature keys. */
export type BrainstormFlagKey =
  | 'anaFlight'
  | 'superlive'
  | 'collectiveListening'
  | 'showLive'
  | 'mapSimulation'
  | 'findMyLove';

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
  showLive: true,
  mapSimulation: false,
  findMyLove: false,
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
  {
    key: 'showLive',
    title: 'Show ao vivo (Fire Arena)',
    description:
      'Pin neon na Arena Fonte Nova (Bahia) que transforma o mapa num palco — vinheta escura ao redor, luzes de palco rosa pulsando sobre o estádio, frame de transmissão acima e chat dos fãs ao lado. Pensado pro lançamento do álbum Fire Arena.',
  },
  {
    key: 'findMyLove',
    title: 'Find my love',
    description:
      'Botão flutuante de coração — ao clicar, globo gigante centralizado com "Em busca pelo mundo...", depois zoom-out + giro do mapa, traça uma linha até um fã aleatório em outro país, revela o match com avatar. Experiência de descoberta surpresa.',
  },
  {
    key: 'mapSimulation',
    title: 'Simulação 7.000 usuários no mapa',
    description:
      'Camada sandbox que rende 7.000 fãs mock distribuídos pelo Brasil (Sudeste, Centro-Oeste, Sul e Norte) com heatmap, clusters e pontos coloridos por tier (verde quando online). HUD com contador de online agora + cidade bombando. Pra testar escala visual e fluidez sem tocar dados reais. Mobile faz subsample automático pra ~2.300 features.',
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
  const isOwner = isBrainstormOwner(user?.email);

  /* Initial render uses ALL_OFF for EVERYONE — was `DEFAULTS`
   * which leaks brainstorm features to non-owners (including
   * brand-new signups) for the first frame before the
   * useEffect snaps to the right value. With ALL_OFF as the
   * SSR / first-paint state, brainstorm features are simply
   * invisible to non-owners from the very first render. The
   * owner takes a one-frame delay before their persisted
   * flags hydrate — an acceptable trade-off compared with
   * the prior visible flash on every other account. */
  const [flags, setFlags] = useState<BrainstormFlags>(() => ({ ...ALL_OFF }));

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
