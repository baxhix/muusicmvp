'use client';

import { useEffect, useState } from 'react';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import FindMyLoveOverlay from './FindMyLoveOverlay';
import styles from './FindMyLoveTrigger.module.css';

/* ============================================================
 * FIND MY LOVE — Trigger flutuante + overlay full-screen.
 *
 * Feature brainstorm: ao clicar no botão de coração, dispara uma
 * experiência de "buscar match no mundo":
 *   1. Globo gigante centralizado + overlay preto + "Em busca pelo
 *      mundo" (~4s).
 *   2. Globo desaparece, mapa real anima (zoom out + giro).
 *   3. Mapa volta zoom-in pro centro entre user e match em outro
 *      país (random das cidades internacionais).
 *   4. Linha verde unindo ambos + avatar do match.
 *
 * Gated por `flags.findMyLove`. Quando desligado, nada renderiza.
 * ============================================================ */

export default function FindMyLoveTrigger() {
  const { flags } = useBrainstormFlags();
  const [open, setOpen] = useState(false);

  // ESC fecha o overlay (cancela a busca)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!flags.findMyLove) return null;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label="Find my love — encontrar match no mundo"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 3 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6.5 4.5 4.5 8.5C19 16.65 12 21 12 21z"/>
        </svg>
      </button>
      {open && <FindMyLoveOverlay onClose={() => setOpen(false)} />}
    </>
  );
}
