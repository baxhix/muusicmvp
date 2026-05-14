'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from '@/components/icons';
import { resolveAssetUrl } from '@/lib/utils';
import type { FeedMediaItem } from '@/types';
import styles from './FeedLightbox.module.css';

/**
 * Full-screen image viewer.
 *
 *   - Keyboard: ← / → navigate, Esc closes, Space toggles zoom.
 *   - Mouse:    click image to toggle zoom, drag to pan while zoomed.
 *   - Touch:    swipe between slides (basic; no momentum).
 *
 * Used by the listing thumbnail click + the composer preview. State
 * is fully controlled by the parent (open + currentIndex) so the
 * lightbox doesn't carry its own selection — easier to deep-link
 * from a comment notification later.
 */

interface Props {
  open: boolean;
  items: FeedMediaItem[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}

export default function FeedLightbox({
  open,
  items,
  index,
  onIndexChange,
  onClose,
}: Props) {
  const safeIndex = items.length > 0
    ? Math.min(Math.max(index, 0), items.length - 1)
    : 0;
  const current = items[safeIndex];
  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Reset zoom + pan whenever the active slide changes — otherwise
  // navigating between images would keep the previous pan offset.
  useEffect(() => {
    setZoomed(false);
    setPan({ x: 0, y: 0 });
  }, [safeIndex, open]);

  // Keyboard nav: ← / → / Esc / Space. Document-level so the
  // lightbox doesn't need focus to react.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (safeIndex < items.length - 1) onIndexChange(safeIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (safeIndex > 0) onIndexChange(safeIndex - 1);
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setZoomed((z) => !z);
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, items.length, safeIndex, onIndexChange, onClose]);

  const onImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomed((z) => !z);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!zoomed) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pan.x,
      baseY: pan.y,
    };
    setDragging(true);
  }, [zoomed, pan]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  if (!open || typeof window === 'undefined' || items.length === 0) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Visualização da imagem"
      onClick={onClose}
    >
      <div className={styles.stage} onClick={(e) => e.stopPropagation()}>
        <div className={styles.topBar} aria-hidden="true">
          <span className={styles.counter}>
            {safeIndex + 1} / {items.length}
          </span>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setZoomed((z) => !z)}
              aria-label={zoomed ? 'Reduzir' : 'Ampliar'}
              title={zoomed ? 'Reduzir (espaço)' : 'Ampliar (espaço)'}
            >
              {/* +/- glyph */}
              <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                {zoomed ? '−' : '+'}
              </span>
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onClose}
              aria-label="Fechar (Esc)"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {items.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.nav} ${styles.navPrev}`}
              onClick={() => onIndexChange(safeIndex - 1)}
              disabled={safeIndex === 0}
              aria-label="Imagem anterior"
            >
              <IconChevronLeft size={20} />
            </button>
            <button
              type="button"
              className={`${styles.nav} ${styles.navNext}`}
              onClick={() => onIndexChange(safeIndex + 1)}
              disabled={safeIndex === items.length - 1}
              aria-label="Próxima imagem"
            >
              <IconChevronRight size={20} />
            </button>
          </>
        )}

        {current && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className={`${styles.image} ${zoomed ? styles.zoomed : ''} ${
              dragging ? styles.zoomedDragging : ''
            }`}
            src={resolveAssetUrl(current.url)}
            alt={current.alt ?? `Imagem ${safeIndex + 1}`}
            draggable={false}
            onClick={onImageClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={
              zoomed
                ? { transform: `scale(2) translate(${pan.x / 2}px, ${pan.y / 2}px)` }
                : undefined
            }
          />
        )}

        {current?.alt && (
          <div className={styles.caption}>{current.alt}</div>
        )}

        {items.length > 1 && (
          <div className={styles.dots} role="tablist">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.dot} ${i === safeIndex ? styles.dotActive : ''}`}
                onClick={() => onIndexChange(i)}
                aria-label={`Ir para imagem ${i + 1}`}
                aria-current={i === safeIndex}
                role="tab"
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
