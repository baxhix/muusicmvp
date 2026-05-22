'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './FloatingByline.module.css';

/**
 * FloatingByline — rail flutuante na lateral esquerda do post
 * detail. Mostra autor (avatar + nome) + share buttons verticais
 * + um indicador discreto de progresso de leitura.
 *
 * Mecânica:
 *   - `position: sticky` dentro de uma grid-cell (`.railSlot` no
 *     CSS do detail page). Quando o reader scrolla pelo corpo
 *     do post, o rail acompanha; quando a body section termina
 *     (tags/author card), o rail desliza junto e some.
 *   - Esconde abaixo de 1100px viewport — em telas estreitas
 *     não há gutter pra colocar o rail sem cobrir o texto.
 *   - Reading progress: scroll listener (rAF-throttled) calcula
 *     quanto da prose body já passou pelo topo do viewport.
 *     Seta a CSS var `--reading-progress` (0–1) pro CSS pintar
 *     uma barrinha vertical fina.
 *   - Entrada com fade + slide sutil quando o rail sticky encosta
 *     no topo do viewport (state `started`).
 *
 * Microinteração inovadora: as 3 partes (autor, share, progresso)
 * estão visualmente conectadas por uma linha vertical fina — a
 * mesma linha que vira o reading progress quando ele preenche.
 */

export interface FloatingBylineProps {
  authorName: string;
  authorAvatarUrl?: string | null;
  authorSlug: string;
  title: string;
  url?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function FloatingByline({
  authorName,
  authorAvatarUrl,
  authorSlug,
  title,
  url,
}: FloatingBylineProps) {
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const proseEl = document.querySelector('[data-prose-body]');
    if (!proseEl) return;

    let raf = 0;
    function check() {
      if (!proseEl) return;
      const r = proseEl.getBoundingClientRect();
      // Progress: quanto do corpo já passou pelo topo do
      // viewport, normalizado pelo (altura - viewport).
      const denom = Math.max(1, r.height - window.innerHeight);
      const p = Math.max(0, Math.min(1, -r.top / denom));
      setProgress(p);
      // "started" = o topo da prose já tocou o topo do viewport.
      setStarted(r.top <= 96);
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

  const resolvedUrl =
    url ?? (typeof window !== 'undefined' ? window.location.href : '');

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    title,
  )}&url=${encodeURIComponent(resolvedUrl)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(
    `${title} — ${resolvedUrl}`,
  )}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    resolvedUrl,
  )}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(resolvedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = resolvedUrl;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <aside
      className={`${styles.rail} ${started ? styles.railStarted : ''}`}
      aria-label="Sobre o autor e compartilhar"
      style={
        // CSS var pra o reading-progress.
        { ['--reading-progress' as string]: progress.toFixed(3) } as React.CSSProperties
      }
    >
      <Link
        href={`/blog/autor/${authorSlug}`}
        className={styles.author}
        aria-label={`Ver perfil de ${authorName}`}
      >
        <span className={styles.avatar}>
          {authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={authorAvatarUrl}
              alt={authorName}
              className={styles.avatarImg}
            />
          ) : (
            <span className={styles.avatarInitials}>
              {getInitials(authorName)}
            </span>
          )}
        </span>
        <span className={styles.authorName}>{authorName}</span>
      </Link>

      {/* Linha vertical conectora que também vira reading
       *  progress: o track é cinza fraco, o fill cresce
       *  conforme `--reading-progress` aumenta. */}
      <div className={styles.track} aria-hidden="true">
        <span className={styles.trackFill} />
      </div>

      <div className={styles.shareCol} role="group" aria-label="Compartilhar">
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.btn}
          aria-label="Compartilhar no X / Twitter"
          title="X / Twitter"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.btn}
          aria-label="Compartilhar no WhatsApp"
          title="WhatsApp"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true">
            <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .17 5.32.17 11.87a11.83 11.83 0 0 0 1.59 5.95L0 24l6.32-1.65a11.88 11.88 0 0 0 5.74 1.46h.01c6.55 0 11.88-5.32 11.88-11.87 0-3.17-1.23-6.15-3.43-8.46Zm-8.46 18.27h-.01a9.86 9.86 0 0 1-5.02-1.37l-.36-.22-3.75.98 1-3.65-.24-.37a9.85 9.85 0 0 1-1.51-5.25c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.13 1.03 7 2.89a9.84 9.84 0 0 1 2.9 7c0 5.46-4.44 9.87-9.91 9.87Zm5.43-7.39c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
          </svg>
        </a>
        <a
          href={fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.btn}
          aria-label="Compartilhar no Facebook"
          title="Facebook"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
            <path d="M22 12a10 10 0 1 0-11.56 9.88V14.9H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.9h-2.33v6.98A10 10 0 0 0 22 12Z" />
          </svg>
        </a>
        <button
          type="button"
          className={`${styles.btn} ${copied ? styles.btnCopied : ''}`}
          onClick={copyLink}
          aria-label="Copiar link"
          title={copied ? 'Copiado!' : 'Copiar link'}
        >
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    </aside>
  );
}
