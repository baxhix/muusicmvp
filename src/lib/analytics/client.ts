/**
 * Provider-agnostic wrappers around the actual analytics SDKs.
 *
 *   - PostHog  → primary store. Receives every event + identify.
 *   - GA4      → secondary "exec dashboard". Receives only events
 *                tagged `ga4: true` in the registry, mirrored via
 *                window.gtag('event', name, props).
 *
 * All functions are SAFE no-ops when the SDK isn't configured:
 *   - PostHog: NEXT_PUBLIC_POSTHOG_KEY missing → init() is a no-op
 *              and capture()/identify() silently drop.
 *   - GA4: window.gtag undefined (which happens until TrackingTags
 *          finishes loading) → gtag('event', …) drops.
 *
 * The fallback semantics matter because:
 *   - SSR rendering can call into this module before window exists
 *   - Local dev typically runs without a PostHog key
 *   - The user can pause analytics via admin Tags without rebuild
 */

import type { EventName, EventPayloadMap } from './events';
import { shouldMirrorToGa4 } from './events';

// posthog-js exports a singleton "default" instance plus typed
// helpers. We lazy-import to keep the SSR bundle tiny — posthog-js
// is browser-only, so we only ever `await import(...)` it inside
// an `if (typeof window !== 'undefined')` guard.
type PostHogJs = typeof import('posthog-js').default;

let _posthog: PostHogJs | null = null;
let _initialized = false;
let _debug = false;

interface InitArgs {
  posthogKey?: string | null;
  posthogHost?: string | null;
  debug?: boolean;
}

/**
 * Initialize the PostHog SDK. Idempotent — calling twice is a
 * no-op. Safe to invoke from any client component on mount.
 * Returns true when the SDK actually loaded, false when skipped.
 */
export async function initClient(args: InitArgs): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (_initialized) return _posthog !== null;
  _initialized = true;
  _debug = Boolean(args.debug);

  const key = args.posthogKey?.trim();
  if (!key) {
    debugLog('PostHog key absent — analytics layer running in no-op mode.');
    return false;
  }

  try {
    const mod = await import('posthog-js');
    const ph = mod.default;
    ph.init(key, {
      api_host: args.posthogHost?.trim() || 'https://us.i.posthog.com',
      // Capture pageviews ourselves via AnalyticsProvider so the
      // event name + properties match the rest of the taxonomy.
      capture_pageview: false,
      capture_pageleave: true,
      // PostHog autocapture grabs every click — useful for
      // discovery but noisy. We rely on explicit `track()` calls
      // for everything that matters, plus a curated `button_clicked`
      // listener (see AnalyticsProvider) for elements tagged with
      // data-analytics-id.
      autocapture: false,
      session_recording: { maskAllInputs: true, maskTextSelector: '[data-private]' },
      persistence: 'localStorage+cookie',
      loaded: () => debugLog('PostHog ready.'),
    });
    _posthog = ph;
    return true;
  } catch (err) {
    console.warn('[analytics] PostHog failed to load:', err);
    return false;
  }
}

/** True if the SDK successfully initialized. */
export function isReady(): boolean {
  return _posthog !== null;
}

export function setDebug(on: boolean): void {
  _debug = on;
}

function debugLog(...args: unknown[]): void {
  if (_debug || process.env.NODE_ENV !== 'production') {
    // Light-touch in production unless explicitly toggled on.
    if (_debug) console.log('[analytics]', ...args);
  }
}

/* ── Event capture ─────────────────────────────────────────────── */

/** Forwards an event to PostHog (always when ready) and GA4
 *  (only when the event is flagged `ga4: true`). */
export function capture<E extends EventName>(
  event: E,
  props: EventPayloadMap[E] & Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;

  // PostHog
  if (_posthog) {
    try {
      _posthog.capture(event, props);
    } catch (err) {
      console.warn(`[analytics] posthog.capture(${event}) failed:`, err);
    }
  }

  // GA4 (when configured at the registry level)
  if (shouldMirrorToGa4(event)) {
    const w = window as Window & { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') {
      try {
        w.gtag('event', event, props);
      } catch (err) {
        console.warn(`[analytics] gtag(${event}) failed:`, err);
      }
    }
  }

  if (_debug) {
    // eslint-disable-next-line no-console
    console.log('[analytics] →', event, props);
  }
}

/* ── Identify + reset ──────────────────────────────────────────── */

export interface IdentifyTraits {
  email?: string | null;
  name?: string | null;
  role?: string;
  city?: string | null;
  country?: string | null;
  /** ISO date of account creation. Powers cohort analyses. */
  signup_date?: string | null;
  /** "spotify" / "magic_link" — captured for funnels. */
  signup_source?: string;
  [key: string]: unknown;
}

/** Attach analytics to a specific user. Subsequent events are
 *  bucketed under this `userId` until `reset()` is called. */
export function identify(userId: string, traits: IdentifyTraits = {}): void {
  if (typeof window === 'undefined') return;
  if (_posthog) {
    try {
      _posthog.identify(userId, traits);
    } catch (err) {
      console.warn('[analytics] posthog.identify failed:', err);
    }
  }
  // GA4: write the user_id property so PostHog + GA4 cross-link.
  const w = window as Window & { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag === 'function') {
    try {
      w.gtag('set', { user_id: userId });
    } catch {
      /* ignore */
    }
  }
  if (_debug) console.log('[analytics] identify', userId, traits);
}

/** Clear the user binding (call on logout). The next event will
 *  be anonymous again. */
export function reset(): void {
  if (typeof window === 'undefined') return;
  if (_posthog) {
    try {
      _posthog.reset();
    } catch (err) {
      console.warn('[analytics] posthog.reset failed:', err);
    }
  }
  if (_debug) console.log('[analytics] reset');
}

/** Per-call test escape hatch (used by jest tests). */
export function __resetForTests(): void {
  _posthog = null;
  _initialized = false;
  _debug = false;
}
