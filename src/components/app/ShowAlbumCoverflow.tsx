'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import styles from './ShowAlbumCoverflow.module.css';

/**
 * ShowAlbumCoverflow — carousel estilo Apple Coverflow pra exibir
 * álbuns de fotos de shows no feed.
 *
 * Mecânica:
 *   - Cada card é renderizado com transform 3D baseado na distância
 *     dele em relação ao card ativo (offset = i - activeIndex).
 *     Card central: scale 1, rotateY 0, translateZ 0. Cards
 *     laterais: scale ~0.78, rotateY ±45°, translateX ±60%,
 *     translateZ -120px. Cards |offset| ≥ 3: opacity 0 (fora da
 *     janela visível).
 *   - Container tem `perspective: 1100px` pra dar profundidade
 *     ao efeito 3D.
 *   - Tap num card lateral → traz pro centro.
 *   - Setas left/right + dots na base pra navegação alternativa.
 *   - Keyboard ←/→ funciona quando o container tem focus.
 *   - Mantém ordem do array de items — o array é estável; só o
 *     `activeIndex` muda. Motion anima cada card pra sua nova
 *     posição relativa via spring (stiffness 280, damping 30).
 *
 * Acessibilidade:
 *   - role="region" no container, aria-label com o título.
 *   - role="tablist" + tabs nos dots.
 *   - Cada card tem aria-label com a alt + posição na sequência.
 *
 * Performance:
 *   - 3D transforms vão pra GPU (composite layer). will-change:
 *     transform marcado pelos cards visíveis.
 *   - Imagens loading="lazy" pros cards fora da janela inicial.
 */

export interface ShowAlbumItem {
  src: string;
  alt: string;
}

interface ShowAlbumCoverflowProps {
  /** Lista ordenada de fotos. Mínimo 1; recomendado 4-8 pra
   *  o efeito 3D fazer sentido visualmente. */
  items: ShowAlbumItem[];
  /** Título do álbum (ex.: "FESPOP 2024 — Goiânia"). Usado pra
   *  legenda + aria-label. */
  title: string;
}

/* Tuning constants — calibrados pra match o modelo de referência
 *  enviado pelo cliente: cards laterais quase-edge-on (rotação
 *  agressiva) com pouco translateX, mostrando só uma fatia
 *  estreita do conteúdo. Card central full size e square. */
const SIDE_TRANSLATE_X = 75;   // % da largura do card pra cada lado
const SIDE_TRANSLATE_Z = -100; // px (negativo = atrás no Z)
const SIDE_ROTATE_Y = 65;      // graus — quase edge-on como o ref
const SIDE_SCALE = 0.92;       // mantém altura próxima do central
/* Card 2+ de distância: rotação ainda maior, mais atrás,
 *  opacity baixa pra fade pra fora. */
const FAR_TRANSLATE_X = 105;
const FAR_TRANSLATE_Z = -220;
const FAR_ROTATE_Y = 78;
const FAR_SCALE = 0.78;

export default function ShowAlbumCoverflow({
  items,
  title,
}: ShowAlbumCoverflowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= items.length) return;
      setActiveIndex(idx);
    },
    [items.length],
  );

  const goPrev = useCallback(() => {
    setActiveIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((i) => Math.min(items.length - 1, i + 1));
  }, [items.length]);

  /* Keyboard nav: setas ←/→ enquanto o container tem focus.
   *  Captura no nível window pra simplificar — só responde se
   *  o post estiver visível (controle implícito via key handler
   *  ignorando quando algum input/textarea tem focus). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (zoomOpen) {
        if (e.key === 'Escape') setZoomOpen(false);
        return;
      }
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, zoomOpen]);

  return (
    <div className={styles.root}>
      <div
        className={styles.stage}
        role="region"
        aria-label={`Álbum: ${title}`}
        aria-roledescription="carousel"
      >
        {items.map((item, i) => {
          const offset = i - activeIndex;
          const absOffset = Math.abs(offset);

          /* Compose transform com base no offset. */
          let translateX = 0;
          let translateZ = 0;
          let rotateY = 0;
          let scale = 1;
          let opacity = 1;
          let zIndex = items.length;

          if (offset === 0) {
            /* Centro — defaults acima. */
          } else if (absOffset === 1) {
            translateX = offset > 0 ? SIDE_TRANSLATE_X : -SIDE_TRANSLATE_X;
            translateZ = SIDE_TRANSLATE_Z;
            rotateY = offset > 0 ? -SIDE_ROTATE_Y : SIDE_ROTATE_Y;
            scale = SIDE_SCALE;
            zIndex = items.length - 1;
          } else if (absOffset === 2) {
            translateX = offset > 0 ? FAR_TRANSLATE_X : -FAR_TRANSLATE_X;
            translateZ = FAR_TRANSLATE_Z;
            rotateY = offset > 0 ? -FAR_ROTATE_Y : FAR_ROTATE_Y;
            scale = FAR_SCALE;
            opacity = 0.45;
            zIndex = items.length - 2;
          } else {
            /* 3+ de distância: fora da janela visível. */
            translateX = offset > 0 ? FAR_TRANSLATE_X * 1.3 : -FAR_TRANSLATE_X * 1.3;
            translateZ = FAR_TRANSLATE_Z;
            rotateY = offset > 0 ? -FAR_ROTATE_Y : FAR_ROTATE_Y;
            scale = FAR_SCALE * 0.85;
            opacity = 0;
            zIndex = 0;
          }

          const isCenter = offset === 0;

          return (
            <motion.button
              type="button"
              key={item.src}
              className={`${styles.card} ${isCenter ? styles.cardCenter : ''}`}
              style={{
                zIndex,
                /* Pointer-events só nos cards perto do centro pra
                 *  swipe lateral / tap funcionar sem clicar nos
                 *  invisíveis. */
                pointerEvents: absOffset > 2 ? 'none' : 'auto',
              }}
              animate={{
                x: `${translateX}%`,
                z: translateZ,
                rotateY,
                scale,
                opacity,
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              onClick={() => {
                if (isCenter) {
                  /* Tap no card central abre zoom-view (fullscreen
                   *  da foto pra ver detalhes). */
                  setZoomOpen(true);
                } else {
                  goTo(i);
                }
              }}
              aria-label={`Foto ${i + 1} de ${items.length}: ${item.alt}`}
              aria-current={isCenter ? 'true' : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.src}
                alt={item.alt}
                className={styles.cardImg}
                loading={absOffset > 1 ? 'lazy' : 'eager'}
                draggable={false}
              />
              {/* Reflection sutil só no card central pra reforçar
                  vibe Coverflow. */}
              {isCenter && (
                <span
                  className={styles.reflection}
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${item.src})` }}
                />
              )}
            </motion.button>
          );
        })}

        {/* Nav arrows — só renderiza se tem mais de 1 foto. */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navBtnPrev}`}
              onClick={goPrev}
              disabled={activeIndex === 0}
              aria-label="Foto anterior"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navBtnNext}`}
              onClick={goNext}
              disabled={activeIndex === items.length - 1}
              aria-label="Próxima foto"
            >
              <ChevronRight />
            </button>
          </>
        )}
      </div>

      {/* Caption + dots row. Caption é a alt da foto ativa — dá
          contexto sobre cada uma sem precisar abrir zoom. */}
      <div className={styles.captionRow}>
        <p className={styles.caption}>{items[activeIndex]?.alt}</p>
        {items.length > 1 && (
          <div
            className={styles.dots}
            role="tablist"
            aria-label="Selecionar foto"
          >
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`Ir pra foto ${i + 1}`}
                className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Zoom overlay: tap no card central abre full-screen pra
          inspecionar detalhes. Tap fora ou Esc fecha. */}
      <AnimatePresence>
        {zoomOpen && (
          <motion.div
            className={styles.zoom}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setZoomOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Visualizar foto em tela cheia"
          >
            <motion.img
              src={items[activeIndex].src}
              alt={items[activeIndex].alt}
              className={styles.zoomImg}
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            />
            <button
              type="button"
              className={styles.zoomClose}
              onClick={(e) => {
                e.stopPropagation();
                setZoomOpen(false);
              }}
              aria-label="Fechar"
            >
              <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M10 2L4 8l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M6 2l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
