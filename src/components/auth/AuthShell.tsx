'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { type ReactNode } from 'react';
import Sparkles from '@/components/teste/Sparkles';
import styles from './AuthShell.module.css';

/* Fotos da Ana (fundo transparente) que se intercalam no media pane do
 * desktop via crossfade CSS. Ordem = ordem de exibição no ciclo. */
const AUTH_MEDIA = ['/ana-01.webp', '/ana-02.webp', '/ana-03.webp', '/ana-04.webp'];

/**
 * AuthShell — layout compartilhado das telas de autenticação
 * + onboarding. Garante consistência visual entre os 6 steps
 * (email, verify, birth-date, profile, interests, success) pra
 * que o fluxo pareça único e contínuo, sem a fricção visual
 * de "login vs cadastro".
 *
 * Estrutura:
 *   ┌─────────────────────────────────────┐
 *   │  ←        [LOGO FANVERSE]           │  ← Top bar
 *   │                                     │
 *   │           [Conteúdo do step]        │
 *   │                                     │
 *   └─────────────────────────────────────┘
 *
 * O logo fica CENTRALIZADO no topo per product feedback. O
 * botão de voltar (chevron-left) fica absolute à esquerda do
 * topo. Em telas com `back="hide"` (ex: email step inicial) a
 * seta some.
 *
 * Progress: se uma fração de progresso é passada, mostra
 * uma barra fina embaixo do top — feedback visual de
 * "quantos steps faltam".
 */

export interface AuthShellProps {
  children: ReactNode;
  /** Onde o botão de voltar leva. Se omitido, usa router.back().
   *  'hide' esconde o botão completamente. */
  back?: string | 'hide';
  /** 0..1 — progresso do fluxo (0 = email, 1 = success). */
  progress?: number;
}

export default function AuthShell({ children, back, progress }: AuthShellProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof back === 'string' && back !== 'hide') {
      router.push(back);
    } else {
      router.back();
    }
  };

  const showBack = back !== 'hide';

  return (
    <main className={styles.shell}>
      {/* Background universo — sparkles espalhadas atrás de
       *  tudo, mesma identidade visual da landing /teste. */}
      <Sparkles count={42} seed={5} />

      {/* Header (logo + voltar) — barra FULL-WIDTH no topo, acima do
       *  split (per product feedback "a barra do header deve ocupar 100%
       *  da largura"). Logo centralizado, back chevron absoluto à esq. */}
      <header className={styles.topBar}>
        {showBack && (
          <button
            type="button"
            className={styles.backBtn}
            onClick={handleBack}
            aria-label="Voltar"
          >
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
          </button>
        )}

        {/* Logo aponta pra / (raiz do site, muusic.live) — saída
         *  do fluxo de auth pro home principal. */}
        <Link href="/" className={styles.logoLink} aria-label="Fanverse — voltar pra home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/teste/fanverse-logo.svg"
            alt="Fanverse"
            className={styles.logo}
          />
        </Link>
      </header>

      {typeof progress === 'number' && (
        <div className={styles.progressTrack} aria-hidden="true">
          <span
            className={styles.progressFill}
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }}
          />
        </div>
      )}

      {/* Split: imagem (60% desktop) + form (40% desktop). No mobile só
       *  o form (a imagem fica display:none e nem baixa — foco em perf). */}
      <div className={styles.split}>
        {/* Media pane — slideshow das fotos da Ana (fundo transparente),
         *  ancorado ao rodapé, 80% da altura (encolhe com a tela). */}
        <aside className={styles.mediaPane} aria-hidden="true">
          {AUTH_MEDIA.map((src) => {
            // eslint-disable-next-line @next/next/no-img-element
            return <img key={src} src={src} alt="" className={styles.mediaImg} loading="lazy" />;
          })}
        </aside>

        <div className={styles.formPane}>
          <section className={styles.content}>{children}</section>
        </div>
      </div>
    </main>
  );
}
