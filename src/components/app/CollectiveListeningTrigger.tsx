'use client';

import { useEffect, useState } from 'react';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import CollectiveListeningModal from './CollectiveListeningModal';
import styles from './CollectiveListeningTrigger.module.css';

/**
 * Brainstorm-gated trigger for the Fire Arena "Audição
 * coletiva" feature.
 *
 * Black fully-rounded pill that sits just below the
 * SuperliveTrigger on the /app home view. Layout:
 *
 *   [ album-cover ] Fire Arena
 *                  Audição coletiva às 20h
 *
 * Tapping the pill opens the CollectiveListeningModal
 * (spinning vinyl + album cover + fake fan chat). The whole
 * component unmounts when the `collectiveListening` flag is
 * flipped off in the BrainstormPanel.
 */
export default function CollectiveListeningTrigger() {
  const { flags } = useBrainstormFlags();
  const [open, setOpen] = useState(false);

  /* Esconde os avatares fixos do LiveChatStack enquanto o modal
   * estiver aberto — mesmo padrão dos demais brainstorms. */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      document.documentElement.setAttribute('data-collective-open', 'true');
    } else {
      document.documentElement.removeAttribute('data-collective-open');
    }
    return () => {
      document.documentElement.removeAttribute('data-collective-open');
    };
  }, [open]);

  if (!flags.collectiveListening) return null;

  return (
    <>
      <button
        type="button"
        className={styles.pill}
        onClick={() => setOpen(true)}
        aria-label="Entrar na audição coletiva"
        title="Audição coletiva"
      >
        <span className={styles.label}>Audição coletiva</span>
      </button>

      <CollectiveListeningModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
