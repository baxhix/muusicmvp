/**
 * Public analytics API.
 *
 *   import { track, identify, reset, page } from '@/lib/analytics';
 *
 * Rule: NEVER call posthog / gtag directly anywhere else in the
 * codebase. This module is the only sanctioned entry point. The
 * upside:
 *   - Single place to add new providers (e.g. Segment, Amplitude)
 *   - TypeScript guarantees event names + payloads match the registry
 *   - One place to add debouncing, deduplication, env gating, etc.
 *
 * Usage:
 *
 *   import { track } from '@/lib/analytics';
 *   track('feed_post_liked', { post_id, creator_name });
 *
 *   import { identify } from '@/lib/analytics';
 *   identify(user.id, { email: user.email, signup_date: user.createdAt });
 *
 *   import { reset } from '@/lib/analytics';
 *   reset();  // on logout
 */

import {
  capture,
  identify as identifyClient,
  initClient,
  isReady,
  reset as resetClient,
} from './client';
import type { EventName, EventPayloadMap } from './events';
import type { IdentifyTraits } from './client';

export type { EventName, EventPayloadMap } from './events';
export type { IdentifyTraits } from './client';

/* ── Globals ──────────────────────────────────────────────────── */

interface GlobalContext {
  session_id: string;
  app_version: string;
  is_authenticated: boolean;
  pathname?: string;
}

let _ctx: GlobalContext = {
  session_id: '',
  app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
  is_authenticated: false,
};

/** Set the global context that's automatically merged into every
 *  event payload. Called by AnalyticsProvider on mount + on auth
 *  state changes. */
export function setContext(patch: Partial<GlobalContext>): void {
  _ctx = { ..._ctx, ...patch };
}

/** Boot the analytics layer. Safe to call multiple times. */
export async function init(args: {
  posthogKey?: string | null;
  posthogHost?: string | null;
  debug?: boolean;
  /** Pre-generated id used to group all events from the same
   *  browser session. */
  sessionId: string;
}): Promise<boolean> {
  setContext({ session_id: args.sessionId });
  return initClient({
    posthogKey: args.posthogKey,
    posthogHost: args.posthogHost,
    debug: args.debug,
  });
}

/* ── Event tracking ───────────────────────────────────────────── */

/**
 * Track an event. Strongly typed:
 *   track('feed_post_liked', { post_id: '...', creator_name: '...' })
 *
 * Globals (session_id, app_version, is_authenticated, pathname)
 * are merged automatically — call sites only pass the event-
 * specific properties from the registry.
 *
 * Dedupe: if the same `(name, dedupe_key)` fires within
 * `dedupe_ms`, the second call is dropped. Optional, off by default.
 */
export function track<E extends EventName>(
  event: E,
  props: EventPayloadMap[E],
  opts?: { dedupeKey?: string; dedupeMs?: number },
): void {
  if (opts?.dedupeKey) {
    if (isDuplicate(event, opts.dedupeKey, opts.dedupeMs ?? 1500)) return;
  }
  const merged = {
    ..._ctx,
    ...(props as Record<string, unknown>),
  };
  capture(event, merged as never);
}

/** Identify the logged-in user. Idempotent — calling with the same
 *  user_id twice is harmless. */
export function identify(userId: string, traits?: IdentifyTraits): void {
  setContext({ is_authenticated: true });
  identifyClient(userId, traits);
}

/** Clear the user binding (on logout). */
export function reset(): void {
  setContext({ is_authenticated: false });
  resetClient();
}

/** Convenience: explicit page_view + pathname context update.
 *  AnalyticsProvider already fires this automatically on route
 *  changes; expose the function so manual screen-level views can
 *  also be reported (e.g. tab/panel transitions inside /app). */
export function page(pathname: string, extra?: { title?: string; referrer?: string }): void {
  setContext({ pathname });
  track('page_view', { pathname, ...(extra ?? {}) });
}

export { isReady };

/* ── Internal: dedupe map ─────────────────────────────────────── */

const _seen = new Map<string, number>();

function isDuplicate(event: string, key: string, windowMs: number): boolean {
  const k = `${event}:${key}`;
  const now = Date.now();
  const prev = _seen.get(k);
  _seen.set(k, now);
  // Prune the map occasionally so it doesn't grow unbounded across
  // a long-lived session.
  if (_seen.size > 500) {
    for (const [mk, t] of _seen) {
      if (now - t > 60_000) _seen.delete(mk);
    }
  }
  return prev !== undefined && now - prev < windowMs;
}
