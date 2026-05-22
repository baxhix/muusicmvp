'use client';

import { useCallback, useEffect, useState } from 'react';
import PostBody from './PostBody';
import styles from './ReadingExperience.module.css';

/**
 * ReadingExperience — wraps o PostBody com:
 *   1. Controles de tamanho de fonte (A- / A+) persistidos em
 *      localStorage. 4 níveis: 14 / 16 / 18 / 20 px.
 *   2. Linha horizontal no topo da viewport que cresce
 *      conforme o leitor desce o scroll — "linha do tempo
 *      de leitura" pedida no product feedback. A barra fica
 *      em position: fixed top: 0, full-width, 2px de altura,
 *      e usa transform: scaleX(progress) com origem à
 *      esquerda pra performance suave.
 *
 * O wrapper precisa ser client porque tanto o
 * localStorage quanto o scroll listener exigem browser. A
 * prop `data-prose-body` continua no nó interno do PostBody
 * pra que o FloatingByline (lateral) calcule o reading
 * progress dele também.
 */

const FONT_STEPS = [14, 16, 18, 20] as const;
const DEFAULT_FONT = 16;
const STORAGE_KEY = 'blog.prose.fontSize';

export interface ReadingExperienceProps {
  html: string;
}

export default function ReadingExperience({ html }: ReadingExperienceProps) {
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Restaura preferência do leitor (se houver).
  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && FONT_STEPS.includes(n as (typeof FONT_STEPS)[number])) {
      setFontSize(n);
    }
  }, []);

  // Persistência do tamanho — sem debounce porque o usuário
  // só clica 1-2 vezes por sessão.
  const persist = useCallback((next: number) => {
    setFontSize(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* localStorage cheio / disabled — ignora silenciosamente. */
    }
  }, []);

  function adjust(delta: -1 | 1) {
    const idx = FONT_STEPS.indexOf(fontSize as (typeof FONT_STEPS)[number]);
    const safeIdx = idx === -1 ? FONT_STEPS.indexOf(DEFAULT_FONT) : idx;
    const next = FONT_STEPS[
      Math.max(0, Math.min(FONT_STEPS.length - 1, safeIdx + delta))
    ];
    if (next !== fontSize) persist(next);
  }

  // Scroll-driven progress no topo. Mesma fórmula do
  // FloatingByline pra que ambos os indicadores fiquem em
  // sincronia. rAF throttle pra não saturar paint.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf = 0;
    function check() {
      const proseEl = document.querySelector('[data-prose-body]');
      if (!proseEl) return;
      const r = proseEl.getBoundingClientRect();
      const denom = Math.max(1, r.height - window.innerHeight);
      const p = Math.max(0, Math.min(1, -r.top / denom));
      setProgress(p);
    }
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        check();
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    check();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Top progress bar — fixed na top edge do viewport. */}
      <div
        className={styles.topProgress}
        role="progressbar"
        aria-label="Progresso de leitura"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-hidden={!mounted}
      >
        <span
          className={styles.topProgressFill}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* Reading toolbar — A- / A+. Renderiza acima da prose,
       *  alinhado à direita pra não competir com o início do
       *  parágrafo. */}
      <div className={styles.toolbar} aria-label="Tamanho do texto">
        <span className={styles.toolbarLabel}>Tamanho</span>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => adjust(-1)}
            disabled={fontSize <= FONT_STEPS[0]}
            aria-label="Diminuir o tamanho do texto"
            title="Diminuir"
          >
            A−
          </button>
          <span className={styles.currentSize} aria-live="polite">
            {fontSize}
          </span>
          <button
            type="button"
            className={styles.btn}
            onClick={() => adjust(1)}
            disabled={fontSize >= FONT_STEPS[FONT_STEPS.length - 1]}
            aria-label="Aumentar o tamanho do texto"
            title="Aumentar"
          >
            A+
          </button>
        </div>
      </div>

      <PostBody html={html} fontSizePx={fontSize} />
    </>
  );
}
