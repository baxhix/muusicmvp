'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { init, identify, reset, setContext, track } from './index';

interface AnalyticsProviderProps {
  /** Optional PostHog project key. Falls back to env, then to the
   *  client-side fetch of /api/site-tags/public. Kept as a prop so
   *  tests can inject deterministic values. */
  posthogKey?: string;
  /** Optional PostHog host (e.g. https://eu.i.posthog.com). */
  posthogHost?: string;
}

/**
 * Boots the analytics layer once on first mount and wires the
 * automatic events the docs promise:
 *
 *   - session_started      → on initial mount
 *   - session_ended        → on visibilitychange=hidden / beforeunload
 *   - page_view            → on every pathname change + initial mount
 *   - navigation_changed   → on every pathname change (excluding mount)
 *   - scroll_depth         → first time the user crosses 25/50/75/100%
 *   - button_clicked       → any click on an element with `data-analytics-id`
 *
 *  Also reacts to auth state:
 *   - identify() once when `user` becomes non-null
 *   - reset() when `user` becomes null
 *
 *  Render-free — just side-effects. Mount once in the root layout
 *  below the AuthProvider so it can read the current user.
 */
export default function AnalyticsProvider({
  posthogKey,
  posthogHost,
}: AnalyticsProviderProps = {}) {
  const pathname = usePathname();
  const { user } = useAuth();

  // ── Boot: init() + session_started fire once on first mount ──
  const bootedRef = useRef(false);
  const sessionStartRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    sessionIdRef.current = generateSessionId();
    sessionStartRef.current = Date.now();

    // Resolve the PostHog key:
    //   1. Prop passed in (tests)
    //   2. NEXT_PUBLIC_POSTHOG_KEY env (build-time, baked in JS)
    //   3. /api/site-tags/public (runtime, admin-editable)
    //
    // We boot eagerly with whatever 1+2 give us; if both miss, we
    // fall back to (3) and re-init when the fetch resolves. This
    // keeps analytics warm in production (where the env key is the
    // common case) while still letting the admin rotate keys
    // through the Tags UI without a redeploy.
    const eagerKey = posthogKey || process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const eagerHost = posthogHost || process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (eagerKey) {
      init({
        posthogKey: eagerKey,
        posthogHost: eagerHost,
        debug: process.env.NODE_ENV !== 'production',
        sessionId: sessionIdRef.current,
      }).catch((err) => console.warn('analytics init failed:', err));
    } else {
      // Lazy fallback — fetch the admin-managed value.
      fetch('/api/site-tags/public', { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: { tags?: { kind: string; value: string }[] }) => {
          const ph = (data.tags ?? []).find((t) => t.kind === 'posthog');
          if (!ph?.value) return;
          init({
            posthogKey: ph.value,
            posthogHost: eagerHost,
            debug: process.env.NODE_ENV !== 'production',
            sessionId: sessionIdRef.current,
          }).catch((err) => console.warn('analytics init (lazy) failed:', err));
        })
        .catch((err) => console.warn('analytics tag fetch failed:', err));
    }

    setContext({
      pathname,
      is_authenticated: false,
    });

    track('session_started', { is_authenticated: false });

    // ── session_ended: best-effort, fires on tab close / hide.
    const endSession = () => {
      const seconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
      track('session_ended', { duration_seconds: seconds });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') endSession();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', endSession);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', endSession);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── page_view + navigation_changed on pathname change ─────────
  const lastPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname) return;
    const prev = lastPathRef.current;
    lastPathRef.current = pathname;
    setContext({ pathname });

    track(
      'page_view',
      {
        pathname,
        title: typeof document !== 'undefined' ? document.title : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      },
      // Soft dedupe: avoids double fire when StrictMode mounts twice.
      { dedupeKey: pathname, dedupeMs: 500 },
    );
    if (prev && prev !== pathname) {
      track('navigation_changed', { from: prev, to: pathname });
    }
  }, [pathname]);

  // ── Identify / reset on auth state change ─────────────────────
  // Use a ref to track the last identified id so we don't re-fire
  // identify on every render of the auth context.
  const identifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (user) {
      if (identifiedRef.current === user.id) return;
      const wasAnonymous = identifiedRef.current === null;
      identifiedRef.current = user.id;
      identify(user.id, {
        email: user.email,
        name: user.name,
        role: user.role,
        city: user.city,
        country: user.country,
      });
      // Fire `auth_login_success` only on the anonymous → identified
      // transition, not on user-id switches (those would be account
      // changes, which are conceptually different). Method defaults
      // to magic_link since that's the only path on the public app
      // right now; the Spotify-OAuth flow can override via track()
      // directly if it lands.
      if (wasAnonymous) {
        track('auth_login_success', { user_id: user.id, method: 'magic_link' });
      }
    } else if (identifiedRef.current) {
      identifiedRef.current = null;
      track('auth_logout', {});
      reset();
    }
  }, [user]);

  // ── Scroll-depth milestones ───────────────────────────────────
  // We track 25/50/75/100% of the document height. One fire per
  // milestone per pathname so navigating + scrolling again on a
  // new route refreshes the bucket without spamming.
  const milestonesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    milestonesRef.current = new Set();
  }, [pathname]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const doc = document.documentElement;
        const height = doc.scrollHeight - window.innerHeight;
        if (height <= 0) return;
        const pct = Math.min(100, Math.max(0, (window.scrollY / height) * 100));
        for (const milestone of [25, 50, 75, 100] as const) {
          if (pct >= milestone && !milestonesRef.current.has(milestone)) {
            milestonesRef.current.add(milestone);
            track('scroll_depth', { depth_percent: milestone, pathname: pathname ?? '' });
          }
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname]);

  // ── Generic button_clicked ───────────────────────────────────
  // Captures any element opting in with `data-analytics-id="…"`.
  // Cheaper than autocapture: only elements we care about appear.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        '[data-analytics-id]',
      );
      if (!target) return;
      const id = target.dataset.analyticsId;
      if (!id) return;
      track('button_clicked', { id, pathname: pathname ?? '' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [pathname]);

  // ── time_on_screen: fire on pathname change with the previous
  // screen's elapsed time. The initial screen reports its time
  // when the user navigates away.
  const screenEnteredRef = useRef<number>(Date.now());
  useEffect(() => {
    const enteredAt = screenEnteredRef.current;
    return () => {
      const seconds = Math.round((Date.now() - enteredAt) / 1000);
      if (seconds >= 1) {
        track('time_on_screen', {
          screen_name: pathname ?? 'unknown',
          seconds,
        });
      }
      screenEnteredRef.current = Date.now();
    };
  }, [pathname]);

  return null;
}

function generateSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
