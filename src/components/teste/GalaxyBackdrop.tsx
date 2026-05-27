'use client';

import { useEffect, useRef } from 'react';
import styles from './GalaxyBackdrop.module.css';

/**
 * Galaxy backdrop pro /teste — duas responsabilidades:
 *
 *  1) Star field denso "tipo Mapbox" — 180 estrelas brancas
 *     minúsculas (0.5..2px) pintadas num ÚNICO <canvas> 2D.
 *     Antes era 180 <span> com `animation` própria — cada um
 *     virava um composited layer e o navegador fritava com 180
 *     simultâneos. Agora é 1 layer só, pintado uma vez na
 *     montagem + nos resizes. Sem rAF de twinkle: as estrelas
 *     ficam ESTÁTICAS (igual o Mapbox no /app, que também não
 *     anima `star-intensity`).
 *
 *  2) Layer de nebulae que se move com o scroll. A
 *     `--galaxy-scroll` (0..1) é setada via JS no
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

// 240 (era 180) — bump leve pra compensar a remoção dos
// <Sparkles> per-section (Hero 28 + Three 36 + Four 40 + Five 32
// = 136 stars). Como o GalaxyBackdrop é fixed no viewport, 240
// fica visível o tempo todo; antes a soma variava por seção.
const STAR_COUNT = 240;

interface Star {
  // Posições normalizadas 0..1 — multiplicadas pela viewport
  // size na hora de desenhar.
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export default function GalaxyBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasMaybe = canvasRef.current;
    const rootMaybe = rootRef.current;
    if (!canvasMaybe || !rootMaybe) return;
    const ctxMaybe = canvasMaybe.getContext('2d', { alpha: true });
    if (!ctxMaybe) return;

    // Re-bind em consts explicitamente tipadas pra preservar o
    // narrowing dentro das closures (`draw`, `resize`,
    // `updateScroll`). A CFA do TypeScript não estende
    // narrowing pra dentro de closures por default.
    const canvas: HTMLCanvasElement = canvasMaybe;
    const ctx: CanvasRenderingContext2D = ctxMaybe;
    const root: HTMLDivElement = rootMaybe;

    // Gera o star field uma vez com seed determinístico (mesmas
    // posições entre montagens, sem hydration concern porque é
    // só client-side de qualquer forma).
    const rng = makeRng(11);
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: rng(),
      y: rng(),
      size: 0.5 + rng() * 1.5,
      alpha: 0.3 + rng() * 0.65,
    }));

    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      // Glow halo via shadow — leve o suficiente pra não exigir
      // composite passes pesados (raio 2px). Equivale ao
      // box-shadow 0 0 3px que o <span> tinha antes.
      ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
      ctx.shadowBlur = 2 * dpr;
      ctx.fillStyle = '#ffffff';
      for (const s of stars) {
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.size * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      draw();
    }

    resize();
    window.addEventListener('resize', resize);

    // --galaxy-scroll: progresso 0..1 setado a cada scroll
    // (rAF-throttled). Setada AGORA no .root do component (era
    // no documentElement) — limita o style-recalc à subárvore
    // de GalaxyBackdrop em vez de cascateá-lo pra árvore
    // inteira do <html>. A .nebulaScroll é filha de .root, então
    // herda a var via cascade naturalmente.
    let scrollRaf = 0;
    function updateScroll() {
      const sy = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, sy / max)) : 0;
      root.style.setProperty('--galaxy-scroll', progress.toFixed(4));
      scrollRaf = 0;
    }
    function onScroll() {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(updateScroll);
    }
    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      {/* Camada de nebulae adicional — translada com o scroll
       *  via --galaxy-scroll (setada no .root acima por JS). */}
      <div className={styles.nebulaScroll} />
      {/* Star field em canvas — 1 layer composited em vez de
       *  180 spans com animation própria. */}
      <canvas ref={canvasRef} className={styles.starCanvas} />
    </div>
  );
}
