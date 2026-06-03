'use client';

import { useEffect, useState } from 'react';
import type { AnaCheckInPayload } from '@/lib/globeStore';
import styles from './AnaCheckInPanel.module.css';

/**
 * Modal that opens when the user taps an Ana Castela check-in pin
 * on the globe. Shows the media carousel (image / video stories),
 * a caption, and the "Ana fez check-in em X" header.
 *
 * Lifecycle is owned by the parent (/app page):
 *   - `payload` is non-null whenever the modal should be open
 *   - `onClose` fires the parent's close handler, which:
 *       (a) closes this modal
 *       (b) keeps the pin on the map for 60s ("linger") then
 *           clears it via globeStore.setAnaCheckIn(null)
 *
 * The modal does NOT touch the pin lifecycle directly — that
 * responsibility stays in /app/page.tsx so the 60s linger is
 * portable to other surfaces later (e.g. a side-rail variant).
 */

interface AnaCheckInPanelProps {
  payload: AnaCheckInPayload | null;
  onClose: () => void;
}

/** "há X min" / "há X h" / "agora". Mirrors the helper in CommunityPanel
 *  so the relative-time language stays consistent across the app. */
function relativeTime(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'agora';
  if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `há ${Math.floor(diffSec / 3600)} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function AnaCheckInPanel({
  payload,
  onClose,
}: AnaCheckInPanelProps) {
  const [index, setIndex] = useState(0);

  // Reset the carousel to the first item every time a fresh
  // payload opens — otherwise a user reopening a different
  // check-in would land on whatever index they left at on the
  // previous one.
  useEffect(() => {
    setIndex(0);
  }, [payload?.id]);

  // Escape closes the modal. Hooked at the document level so
  // the close shortcut works even when the carousel buttons
  // have focus.
  useEffect(() => {
    if (!payload) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      if (e.key === 'ArrowRight') {
        setIndex((i) => Math.min(i + 1, (payload?.media.length ?? 1) - 1));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [payload, onClose]);

  if (!payload) return null;

  const current = payload.media[index];
  const total = payload.media.length;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header — pinned label + close. Solid black-tinted strip
         *  so it stays readable over bright photos. */}
        <header className={styles.header}>
          <div className={styles.headerAvatarWrap}>
            <span className={styles.headerPulse} aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ana-castela-fanverse-hero.jpg"
              alt=""
              className={styles.headerAvatar}
            />
          </div>
          <div className={styles.headerText}>
            <span className={styles.headerTitle}>
              Ana fez check-in em <strong>{payload.city}-{payload.state}</strong>
            </span>
            <span className={styles.headerTime}>
              {relativeTime(payload.startedAt)} · conteúdo exclusivo
            </span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg viewBox="0 0 10 10" width="12" height="12" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* Media stage — image or video. The carousel is single-up
         *  with arrow buttons + a dot indicator below. */}
        <div className={styles.mediaStage}>
          {current?.type === 'video' ? (
            <video
              key={current.url /* force a fresh element when index changes so autoplay re-fires */}
              className={styles.media}
              src={current.url}
              poster={current.poster ?? undefined}
              controls
              autoPlay
              playsInline
              muted
              loop
            />
          ) : current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.alt ?? `Check-in de Ana Castela em ${payload.city}`}
              className={styles.media}
            />
          ) : (
            <div className={styles.mediaEmpty}>
              Nenhuma mídia disponível.
            </div>
          )}

          {canPrev && (
            <button
              type="button"
              className={`${styles.arrow} ${styles.arrowLeft}`}
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              aria-label="Anterior"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {canNext && (
            <button
              type="button"
              className={`${styles.arrow} ${styles.arrowRight}`}
              onClick={() => setIndex((i) => Math.min(i + 1, total - 1))}
              aria-label="Próxima"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Caption + dot indicator. */}
        <footer className={styles.footer}>
          {payload.caption && (
            <p className={styles.caption}>{payload.caption}</p>
          )}
          {total > 1 && (
            <div className={styles.dots} role="tablist" aria-label="Mídia do check-in">
              {payload.media.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Ir para mídia ${i + 1}`}
                  className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
