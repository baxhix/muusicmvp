'use client';

import { useEffect } from 'react';

/**
 * Mount-once component that wires window-level handlers for the two
 * error channels that bypass React's render tree:
 *
 *  - `error`              — uncaught exceptions in event handlers, timers,
 *                           etc. (anything outside async).
 *  - `unhandledrejection` — promise rejections that nobody awaited.
 *
 * Both just log to the console with a recognizable prefix. A future
 * Sentry/LogRocket integration can hook in here without touching call
 * sites. The point is: when the realtime layer or some lib throws into
 * the void, we still see it in DevTools instead of silent failure.
 */
export default function GlobalErrorLogger() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      console.error('[window.error]', e.error ?? e.message, {
        source: e.filename,
        line: e.lineno,
        col: e.colno,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      console.error('[unhandledrejection]', e.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
