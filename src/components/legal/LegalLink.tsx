'use client';

import { type ReactNode } from 'react';
import {
  openLegalDrawer,
  type LegalKind,
  type LegalSurface,
} from '@/lib/legal/legalDrawerBus';
import styles from './LegalLink.module.css';

interface Props {
  kind: LegalKind;
  surface?: LegalSurface;
  className?: string;
  children: ReactNode;
}

/**
 * LegalLink — gatilho inline (parece um link de texto) que, em vez
 * de navegar pra /termos|/privacidade, abre o LegalDrawer lateral.
 * Funciona dentro de Server Components (é client) e herda o
 * estilo do contexto via `className`. O `.reset` zera o chrome de
 * <button> pra ele se comportar como texto inline.
 */
export default function LegalLink({
  kind,
  surface = 'site',
  className,
  children,
}: Props) {
  return (
    <button
      type="button"
      className={className ? `${styles.reset} ${className}` : styles.reset}
      onClick={(e) => {
        // stopPropagation pra não disparar handlers do contêiner —
        // ex: dentro do <label> do MotionCheckbox, abrir o drawer
        // NÃO deve marcar o aceite dos termos.
        e.stopPropagation();
        openLegalDrawer(kind, surface);
      }}
    >
      {children}
    </button>
  );
}
