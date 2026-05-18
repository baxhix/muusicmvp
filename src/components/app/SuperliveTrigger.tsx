'use client';

import { useState } from 'react';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import SuperliveModal from './SuperliveModal';
import styles from './SuperliveTrigger.module.css';

/**
 * Brainstorm-gated entry point for the Superlive surface.
 *
 * Renders a prominent live-broadcast card at the top of the home
 * view whenever the `superlive` flag is on. The card surfaces the
 * essentials a fan needs to decide whether to tap in: the AO VIVO
 * pill (with pulsing dot), Ana's avatar + name, the live viewer
 * count, and a high-contrast "Entrar na live" CTA. Tapping
 * anywhere on the card opens the SuperliveModal (looping vertical
 * video + fake fan chat). When the brainstorm flag flips off, the
 * whole component unmounts.
 *
 * Self-contained: owns the open/closed modal state and the flag
 * gate. Mount once inside /app/page.tsx and forget.
 */
export default function SuperliveTrigger() {
  const { flags } = useBrainstormFlags();
  const [open, setOpen] = useState(false);

  if (!flags.superlive) return null;

  return (
    <>
      <button
        type="button"
        className={styles.card}
        onClick={() => setOpen(true)}
        aria-label="Entrar na transmissão ao vivo da Ana"
        title="Ana Castela ao vivo"
      >
        <span className={styles.pulse} aria-hidden="true" />

        <span className={styles.topRow}>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} aria-hidden="true" />
            AO VIVO
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ana-castela.png"
            alt=""
            className={styles.avatar}
            aria-hidden="true"
          />
          <span className={styles.identity}>
            <span className={styles.name}>Ana Castela</span>
            <span className={styles.viewers}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              24,8k assistindo
            </span>
          </span>
        </span>

        <span className={styles.cta}>
          Entrar na live
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </button>

      <SuperliveModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
