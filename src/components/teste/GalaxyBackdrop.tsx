'use client';

import { useEffect, useMemo } from 'react';
import styles from './GalaxyBackdrop.module.css';

/**
 * Galaxy backdrop pro /teste — duas responsabilidades:
 *
 *  1) Star field denso "tipo Mapbox" — 180 pontos brancos
 *     minúsculos (0.5..2px), distribuídos com seed
 *     determinístico (mesma posição entre SSR/CSR pra evitar
 *     hydration mismatch). Espelha o efeito do
 *     `setFog({ 'star-intensity': 0.45 })` que o Mapbox usa no
 *     /app, mas em DOM. Cada estrela tem opacidade base + um
 *     twinkle MUITO lento (5..12s) variando 0.5 → 1.0 — não é
 *     pisca-pisca, é "brilho de fundo respirando".
 *
 *  2) Layer de nebulae adicional que se move com o scroll.
 *     A `--galaxy-scroll` (0..1) é setada via JS no
 *     documentElement; o CSS abaixo usa essa variável pra
 *     translatear as nebulae verticalmente. Combina com a
 *     animação `galaxy-drift` estática do `.page::before` (em
 *     page.module.css): aquela faz o ambient breathing
 *     contínuo, esta entrega o parallax-galaxy conforme o
 *     usuário desce.
 *
 * pointer-events:none + aria-hidden porque é puramente
 * decorativo. position:fixed pra ancorar ao viewport (não
 * scrolla com o documento).
 */

function makeRng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COUNT = 180;

export default function GalaxyBackdrop() {
  const stars = useMemo(() => {
    const rng = makeRng(11);
    return Array.from({ length: STAR_COUNT }, (_, i) => ({
      id: i,
      top: rng() * 100,
      left: rng() * 100,
      // Tamanho 0.5..2px — pinpoint, mesma faixa do que Mapbox
      // gera com star-intensity ~0.45.
      size: 0.5 + rng() * 1.5,
      // Opacidade base 0.3..0.9 — variação garante densidade
      // visual sem que todas leiam como brilho uniforme.
      opacity: 0.3 + rng() * 0.6,
      delay: rng() * 8,
      // Twinkle BEM lento (5..13s) pra não distrair.
      duration: 5 + rng() * 8,
    }));
  }, []);

  useEffect(() => {
    // Lê o scroll e expõe progress (0..1) como CSS variable
    // global. Usa rAF pra throttle natural — 1 update por frame
    // de paint, mesmo em scrolls violentos no trackpad.
    let raf = 0;
    function update() {
      const sy = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, sy / max)) : 0;
      document.documentElement.style.setProperty(
        '--galaxy-scroll',
        progress.toFixed(4),
      );
      raf = 0;
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.style.removeProperty('--galaxy-scroll');
    };
  }, []);

  return (
    <div className={styles.root} aria-hidden="true">
      {/* Camada de nebulae adicional — translada com o scroll
       *  via --galaxy-scroll. Soma-se ao gradient estático do
       *  .page::before (em page.module.css). */}
      <div className={styles.nebulaScroll} />
      {/* Star field denso */}
      <div className={styles.starLayer}>
        {stars.map((s) => (
          <span
            key={s.id}
            className={styles.star}
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
