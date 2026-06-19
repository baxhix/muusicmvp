'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import fields from './AuthFields.module.css';

/**
 * StepFrame — wrapper dos steps de cadastro (verify, birth-date,
 * profile). Provê três coisas pedidas no feedback:
 *
 *  1. Loading curto (2s) ao montar o step → sensação de transição
 *     "entre um step e outro".
 *  2. Seta de voltar (reforço) logo acima do título, alinhada à
 *     esquerda — leva pro step anterior (backHref).
 *  3. Conteúdo alinhado à esquerda (align-items: flex-start).
 *
 * O loading roda dentro do AuthShell (header + foto permanecem), só a
 * área do form troca pra um spinner pequeno e depois revela o conteúdo.
 */

const STEP_LOADING_MS = 2000;

export default function StepFrame({
  backHref,
  children,
}: {
  backHref: string;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), STEP_LOADING_MS);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className={fields.stepLoading} aria-live="polite" aria-busy="true">
        <span className={fields.stepSpinner} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={fields.stepInner}>
      {/* Seta de voltar — reforço pro usuário voltar ao step anterior. */}
      <Link href={backHref} className={fields.stepBack} aria-label="Voltar">
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </Link>
      {children}
    </div>
  );
}
