'use client';

import { useEffect, useState } from 'react';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import SuperliveModal from './SuperliveModal';
import styles from './SuperliveTrigger.module.css';

/**
 * Brainstorm-gated entry point for the Superlive surface.
 *
 * Renders a wide horizontal "broadcast pill" at the top of the
 * home view whenever the `superlive` flag is on. Everything the
 * fan needs to decide whether to tap in sits on a single row:
 * AO VIVO pill with pulsing dot · Ana's avatar · name + viewer
 * count · "Entrar na live" CTA pill on the right. Tapping
 * anywhere on the row opens the SuperliveModal (looping vertical
 * video + fake fan chat). The whole component unmounts when the
 * brainstorm flag flips off.
 *
 * Self-contained: owns the open/closed modal state and the flag
 * gate. Mount once inside /app/page.tsx and forget.
 */
export default function SuperliveTrigger() {
  const { flags } = useBrainstormFlags();
  const [open, setOpen] = useState(false);

  /* Esconde os avatares fixos do LiveChatStack enquanto o modal
   * estiver aberto — mesmo padrão usado pelo Brainstorm / Show ao
   * vivo, pra que as miniaturas do chat não cubram a UI do modal
   * no mobile. */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      document.documentElement.setAttribute('data-superlive-open', 'true');
    } else {
      document.documentElement.removeAttribute('data-superlive-open');
    }
    return () => {
      document.documentElement.removeAttribute('data-superlive-open');
    };
  }, [open]);

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
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            24,8k
          </span>
        </span>

        <span className={styles.cta}>
          Entrar
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </button>

      <SuperliveModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
