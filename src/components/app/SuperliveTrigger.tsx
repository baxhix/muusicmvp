'use client';

import { useState } from 'react';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import SuperliveModal from './SuperliveModal';
import styles from './SuperliveTrigger.module.css';

/**
 * Brainstorm-gated entry point for the Superlive surface.
 *
 * Renders a floating "AO VIVO" pill below the home header
 * whenever the `superlive` flag is on. Clicking the pill opens
 * the SuperliveModal (looping video + fake fan chat). When the
 * flag flips off via the BrainstormPanel toggle, this whole
 * component unmounts — no leftover pill on the surface.
 *
 * Self-contained: owns the open/closed state for the modal and
 * the flag gate. Mount it once inside /app/page.tsx and forget.
 */
export default function SuperliveTrigger() {
  const { flags } = useBrainstormFlags();
  const [open, setOpen] = useState(false);

  if (!flags.superlive) return null;

  return (
    <>
      <button
        type="button"
        className={styles.pill}
        onClick={() => setOpen(true)}
        aria-label="Abrir transmissão ao vivo da Ana"
        title="Ana ao vivo"
      >
        <span className={styles.pulse} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ana-castela.png"
          alt=""
          className={styles.avatar}
          aria-hidden="true"
        />
        <span className={styles.text}>
          <span className={styles.live}>
            <span className={styles.liveDot} aria-hidden="true" />
            AO VIVO
          </span>
          <span className={styles.name}>Ana Castela</span>
        </span>
        <span className={styles.viewers} aria-hidden="true">
          24,8k
        </span>
      </button>

      <SuperliveModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
