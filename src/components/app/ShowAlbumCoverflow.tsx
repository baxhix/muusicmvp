'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import Lightbox from './Lightbox';
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

/* Tuning constants — calibrados pra match o modelo de referência:
 *  cards laterais quase-edge-on (rotação agressiva) com translateX
 *  moderado pra ficarem encostados ao card central sem extrapolar
 *  o stage. Card central full size square. */
const SIDE_TRANSLATE_X = 42;   // % da largura do card pra cada lado
const SIDE_TRANSLATE_Z = -80;  // px (negativo = atrás no Z)
const SIDE_ROTATE_Y = 62;      // graus — edge-on como o ref
const SIDE_SCALE = 0.94;       // altura quase igual ao central
/* Card 2+ de distância: rotação ainda maior, mais atrás,
 *  opacity baixa pra fade pra fora. */
const FAR_TRANSLATE_X = 70;
const FAR_TRANSLATE_Z = -200;
const FAR_ROTATE_Y = 78;
const FAR_SCALE = 0.78;

export default function ShowAlbumCoverflow({
  items,
  title,
}: ShowAlbumCoverflowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  /* Direction (-1/+1) — controla o slide direcional no coverflow
   *  stage interno (cards giram pro lado correto). O lightbox de
   *  zoom usa o componente compartilhado <Lightbox /> com sua
   *  própria direction interna. */
  const [, setDirection] = useState<1 | -1>(1);

  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= items.length) return;
      setActiveIndex(idx);
    },
    [items.length],
  );

  const goPrev = useCallback(() => {
    setDirection(-1);
    setActiveIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
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
      <motion.div
        className={styles.stage}
        role="region"
        aria-label={`Álbum: ${title}`}
        aria-roledescription="carousel"
        /* Pan handler captura swipe horizontal SEM mexer no
         *  transform dos cards (que continuam animando via
         *  animate props). onPanEnd decide goPrev/goNext baseado
         *  no offset + velocity. Threshold 60px / 300 velocity. */
        onPanEnd={(_, info) => {
          const ox = info.offset.x;
          const vx = info.velocity.x;
          if (ox < -60 || vx < -300) goNext();
          else if (ox > 60 || vx > 300) goPrev();
        }}
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
              /* CRITICAL — motion sobrescreve a property `transform`
               *  da CSS, então o `translate(-50%, -50%)` que ancorava
               *  o card no centro (via top:50%/left:50%) era perdido,
               *  deixando os cards flat sem rotação 3D visível. O
               *  transformTemplate prepend o -50% -50% ANTES do
               *  transform gerado por motion, restaurando o anchor
               *  e fazendo a rotação girar em torno do próprio
               *  centro do card. */
              transformTemplate={(_props, generatedTransform) =>
                `translate(-50%, -50%) ${generatedTransform}`
              }
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

        {/* Nav arrows removidas per spec — swipe horizontal
         *  (onPanEnd no stage acima) é a navegação primária.
         *  Dots continuam no captionRow pra navegação direta. */}
      </motion.div>

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

      {/* Zoom — Lightbox compartilhado da plataforma. Padrão único
       *  (close top-right, counter top-left, nav arrows, dots,
       *  swipe horizontal, keyboard). */}
      {zoomOpen && (
        <Lightbox
          items={items.map((it, i) => ({
            id: `album-${i}-${it.src}`,
            src: it.src,
            alt: it.alt,
          }))}
          index={activeIndex}
          onIndexChange={(i) => {
            setDirection(i > activeIndex ? 1 : -1);
            setActiveIndex(i);
          }}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </div>
  );
}

/* ChevronLeft / ChevronRight removidas — nav arrows não existem
 *  mais; navegação 100% por swipe (onPanEnd no stage) + dots. */
