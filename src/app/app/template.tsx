'use client';

import styles from './template.module.css';

/**
 * Per-route entrance animation. `template.tsx` re-runs on every
 * navigation (unlike `layout.tsx` which preserves state) — that's
 * what makes the wrapper's fade-in fire every time the user lands
 * on a route, without rebuilding the entire shell.
 *
 * The animation is subtle (220ms opacity + 4px translateY) so it
 * never competes with the panel's own entrance transform — most
 * routes render a position:fixed panel that slides up; the template
 * just nudges the content opacity from 0 → 1 underneath.
 *
 * Respects prefers-reduced-motion via the CSS guard.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={styles.transition}>{children}</div>;
}
