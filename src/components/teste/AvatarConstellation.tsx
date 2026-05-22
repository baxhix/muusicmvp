'use client';

import { useEffect, useMemo, useState } from 'react';
import FloatingAvatar from './FloatingAvatar';

/**
 * Constellation — UM ÚNICO set de avatares flutuantes, ativos
 * durante toda a experiência da landing (não mais um set por
 * section).
 *
 * Visibilidade controlada por scroll:
 *   - Hidden no topo da página (scrollY <= 60px).
 *   - REVELAM quando o usuário scrolla qualquer mínimo (>60px,
 *     começando a entrar na Section 2 da landing).
 *   - Permanecem visíveis enquanto o footer não está
 *     totalmente visível.
 *   - Hidden de novo quando footer.bottom <= viewport.bottom
 *     (footer totalmente revelado).
 *
 * Posicionamento INORGÂNICO: 15 avatares distribuídos
 * aleatoriamente em torno das BORDAS da viewport (com zona
 * central excluída pra deixar conteúdo respirar). Sem forma
 * geométrica clara — apenas pontos random com anti-overlap.
 */

interface AvatarSlot {
  name: string;
  /** Path opcional pra imagem. Sem src → renderiza placeholder
   *  cinza + iniciais (modo wireframe). */
  src?: string;
  circling?: boolean;
  driftDelay?: number;
  style: React.CSSProperties;
}

/* SECTION_AVATARS removido per product feedback "os demais
 * avatares podem ser excluídos das outras seções e vamos
 * ficar apenas com as animações flutuantes". */

/**
 * Floaters — 15 avatares random ao redor das BORDAS da viewport.
 *
 * Per product feedback "a aproximação dos avatares em formato
 * de círculo não deve ser perfeito, deve ser apenas um grupo".
 *
 * Estratégia:
 *   - Ângulos base distribuídos a cada 30° (12 fatias) MAS
 *     com jitter generoso de ±15° — algumas fatias quase se
 *     fundem, outras abrem.
 *   - Raio VARIÁVEL pra cada avatar (40-100% do max). Quem
 *     "ficou mais perto do centro" e quem "ficou mais longe"
 *     varia organicamente — quebra completamente a leitura
 *     de "anel" e dá profundidade ao cluster.
 *   - Sem labels, sem ring colorido — só formação visual.
 *   - Approach extra ainda é radial (sai de fora pra dentro)
 *     mas calcula com base no raio FINAL de cada um pra que
 *     o slide-in respeite a distância individual.
 *   - driftDelay continua dessincronizando a respiração.
 *
 * RNG: mulberry32 com seed fixo (73) pra render determinístico
 * SSR/CSR — sem hydration mismatch.
 */
/**
 * 3 fotos de usuário existentes — recicladas em ciclo entre os
 * 12 avatares do grupo per product feedback "use as imagens
 * dos primeiros avatares para as simulações de avatares que
 * se aproximam, mesmo que se repitam".
 */
const CIRCLE_AVATAR_SRCS = [
  '/teste/user-01.png',
  '/teste/user-02.png',
  '/teste/user-03.png',
];

function buildFloatingSlots(): AvatarSlot[] {
  const count = 15;

  /* Distribuição INORGÂNICA, RANDOM, sem forma geométrica
   * clara, ao redor das BORDAS da viewport per product
   * feedback "posicionar ao redor dos limites da página,
   * forma inorgânica, aleatórios, sem ter uma forma
   * geometrica clara".
   *
   * Algoritmo: random rejection sampling em coordenadas
   * cartesianas (não polares, pra evitar forma de anel).
   *
   * Regras de aceitação:
   *   1. ao menos UM eixo deve estar "extremo" (perto da borda).
   *      |fx| > 28 vmin OU |fy| > 24 vmin. Isso garante que
   *      avatares estejam SEMPRE perto de pelo menos uma das
   *      4 bordas, NUNCA na zona central morta.
   *   2. anti-overlap: distância mínima de 13vmin entre dois
   *      avatares.
   *
   * Limites: |fx| <= 44vmin (≈ 88% da largura útil), |fy| <=
   * 36vmin (deixa folga pro header fixo no topo / footer no
   * bottom).
   */
  const maxX = 44;
  const maxY = 36;
  const extremeXThreshold = 28; // |fx| > 28 → considera "perto da borda H"
  const extremeYThreshold = 24; // |fy| > 24 → "perto da borda V"
  const minDistance = 13; // vmin

  let seed = 73;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const positions: Array<{ fx: number; fy: number }> = [];
  let attempts = 0;
  while (positions.length < count && attempts < 10000) {
    attempts++;
    const fx = (rng() - 0.5) * 2 * maxX;
    const fy = (rng() - 0.5) * 2 * maxY;

    // Regra 1: tem que estar perto de alguma borda
    const extremeX = Math.abs(fx) > extremeXThreshold;
    const extremeY = Math.abs(fy) > extremeYThreshold;
    if (!extremeX && !extremeY) continue;

    // Regra 2: anti-overlap
    if (positions.some(
      (p) => Math.hypot(p.fx - fx, p.fy - fy) < minDistance,
    )) continue;

    positions.push({ fx, fy });
  }

  return positions.map((pos, i) => {
    /* Approach: cada avatar entra a partir de um ponto FORA
     * da viewport, 180° oposto à posição final (crossover).
     * startRadius 70vmax garante que o ponto inicial está
     * sempre além das bordas, pra qualquer aspect ratio. */
    const angle = Math.atan2(pos.fy, pos.fx);
    const startRadius = 70; // vmax
    const startAngle = angle + Math.PI;
    const sx = Math.cos(startAngle) * startRadius;
    const sy = Math.sin(startAngle) * startRadius;

    /* Velocidades intercaladas. */
    const enterDurationMs = 3500 + rng() * 2000;
    const driftDurationSec = 7 + rng() * 4;

    return {
      name: `floater-${i}`,
      src: CIRCLE_AVATAR_SRCS[i % CIRCLE_AVATAR_SRCS.length],
      circling: true,
      driftDelay: rng() * 4,
      style: {
        left: `calc(50% + ${pos.fx.toFixed(2)}vmin - 24px)`,
        top: `calc(50% + ${pos.fy.toFixed(2)}vmin - 24px)`,
        ['--circle-tx' as string]:
          `calc(${sx.toFixed(2)}vmax - ${pos.fx.toFixed(2)}vmin)`,
        ['--circle-ty' as string]:
          `calc(${sy.toFixed(2)}vmax - ${pos.fy.toFixed(2)}vmin)`,
        ['--enter-duration' as string]: `${Math.round(enterDurationMs)}ms`,
        ['--drift-duration' as string]: `${driftDurationSec.toFixed(2)}s`,
      } as React.CSSProperties,
    };
  });
}

export default function AvatarConstellation() {
  /**
   * Visibilidade: derivado de scroll.
   *   - showAt: scrollY > 60px (mínimo scroll detectável).
   *   - hideAt: footer totalmente visível na viewport.
   */
  const [floatingVisible, setFloatingVisible] = useState(false);

  /** Slots geradas uma vez (memoized pra estabilidade entre
   *  renders + evitar hydration mismatch). */
  const slots = useMemo(() => buildFloatingSlots(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let raf = 0;
    function check() {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;

      // Mínimo scroll pra ativar (60px é suficiente — entrando
      // na transição Section 1 → Section 2).
      const hasScrolled = scrollY > 60;

      // Footer totalmente visível? Olha o rect do <footer>.
      // Quando o bottom do footer entra no viewport (ou está
      // acima dele), o footer está totalmente revelado.
      const footer = document.querySelector('footer');
      let footerFullyVisible = false;
      if (footer) {
        const fr = footer.getBoundingClientRect();
        footerFullyVisible = fr.bottom <= vh + 1; // +1 pra tolerância
      }

      const next = hasScrolled && !footerFullyVisible;
      setFloatingVisible((prev) => (prev === next ? prev : next));
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
      {slots.map((a) => (
        <FloatingAvatar
          key={a.name}
          src={a.src}
          name={a.name}
          size="sm"
          revealed={floatingVisible}
          circling={a.circling}
          driftDelay={a.driftDelay}
          style={a.style}
        />
      ))}
    </>
  );
}
