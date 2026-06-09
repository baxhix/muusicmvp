'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import styles from './Lightbox.module.css';

/**
 * Lightbox — overlay fullscreen edge-to-edge unificado pra
 * preview de imagens em toda a plataforma. Per spec atualizado,
 * todos os lightboxes (chat attachments, álbum coverflow,
 * pastas exclusivas) seguem esse mesmo padrão:
 *
 *  - Backdrop quase opaco (~96%) + blur 20px.
 *  - Close button circular top-right (44×44) com blur + border.
 *  - Counter "i/N" top-left (só quando items.length > 1).
 *  - Nav arrows laterais (só quando > 1 item).
 *  - Stage central: motion.img edge-to-edge com max 100vw/100vh,
 *    object-fit:contain. AnimatePresence + custom direction →
 *    slide direcional ao trocar de item via arrows/dots/swipe.
 *  - Drag horizontal pra navegar entre imagens (mobile-first).
 *  - Keyboard: ←/→ navega, Esc fecha.
 *  - Meta pill bottom-center: nome do item + botão Download
 *    com gradient-border brand (orange→pink→purple). Só
 *    aparece quando o item carrega name OU downloadUrl.
 *  - Dots bottom strip (só quando > 1 item) — gradient pill
 *    no ativo.
 *  - createPortal pra document.body — escapa de qualquer
 *    containing block (overflow:hidden, backdrop-filter stacking
 *    context, etc).
 *
 * O componente é "burro": recebe items + index controlado pelo
 * parent. Não gerencia mounting state; espera ser renderizado
 * condicionalmente (`{open && <Lightbox ... />}`).
 */

export interface LightboxItem {
  /** Chave única do item — usada pelo AnimatePresence key. */
  id: string;
  /** URL da imagem em resolução pro lightbox (idealmente 1600+). */
  src: string;
  /** Texto alternativo da imagem (acessibilidade). */
  alt?: string;
  /** Nome exibido no meta pill bottom. Sem isso, o pill esconde. */
  name?: string;
  /** URL pra download — se omitido, o botão Download não aparece. */
  downloadUrl?: string;
  /** Atributo `download` do <a>. Default: name. */
  downloadName?: string;
}

interface LightboxProps {
  items: LightboxItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

export default function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: LightboxProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  /* Direction (-1 esq / +1 dir) — alimentado pelo nav handler;
   *  determina pra qual lado a img nova entra no AnimatePresence. */
  const [direction, setDirection] = useState<1 | -1>(1);

  const item = items[index];

  const goPrev = useCallback(() => {
    if (index <= 0) return;
    setDirection(-1);
    onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index >= items.length - 1) return;
    setDirection(1);
    onIndexChange(index + 1);
  }, [index, items.length, onIndexChange]);

  /* Keyboard nav — ←/→ navega entre itens, Esc fecha. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  if (!item) return null;
  if (!mounted || typeof document === 'undefined') return null;

  const hasMultiple = items.length > 1;
  const hasMeta = Boolean(item.name || item.downloadUrl);

  const content = (
    <motion.div
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={item.alt ?? item.name ?? 'Imagem em tamanho maior'}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Close — top-right circular w/ blur. */}
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Fechar"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {hasMultiple && (
        <>
          {/* Counter "i/N" top-left. */}
          <div className={styles.counter} aria-hidden="true">
            {index + 1} / {items.length}
          </div>

          {/* Nav arrows — esconder os disabled mas manter o slot. */}
          <button
            type="button"
            className={`${styles.nav} ${styles.navPrev}`}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            disabled={index === 0}
            aria-label="Imagem anterior"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.nav} ${styles.navNext}`}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            disabled={index === items.length - 1}
            aria-label="Próxima imagem"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Stage — clique aqui não propaga (não fecha overlay). */}
      <div
        className={styles.stage}
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait" custom={direction}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            key={item.id}
            src={item.src}
            alt={item.alt ?? item.name ?? ''}
            className={styles.img}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ opacity: 0, x: dir * 60 }),
              center: { opacity: 1, x: 0 },
              exit: (dir: number) => ({ opacity: 0, x: dir * -60 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            /* Drag horizontal — só quando há múltiplos itens. */
            drag={hasMultiple ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -60 || info.velocity.x < -300) goNext();
              else if (info.offset.x > 60 || info.velocity.x > 300) goPrev();
            }}
          />
        </AnimatePresence>

        {hasMeta && (
          <div className={styles.meta}>
            {item.name && (
              <div className={styles.name}>{item.name}</div>
            )}
            {item.downloadUrl && (
              <a
                className={styles.download}
                href={item.downloadUrl}
                download={item.downloadName ?? item.name ?? 'download'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Baixar
              </a>
            )}
          </div>
        )}

        {hasMultiple && (
          <div
            className={styles.dots}
            role="tablist"
            aria-label="Selecionar imagem"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Ir pra imagem ${i + 1}`}
                className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
                onClick={() => {
                  setDirection(i > index ? 1 : -1);
                  onIndexChange(i);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  return createPortal(content, document.body);
}
