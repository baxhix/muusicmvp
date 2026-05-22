'use client';

import { useEffect, useMemo, useState } from 'react';
import FloatingAvatar from './FloatingAvatar';

/**
 * Constellation — todos os avatares do /teste num só lugar, com
 * posicionamento fixo na viewport.
 *
 * Mecânica:
 *   - Cada avatar tem um `section` (1/2/3/4) — a section em
 *     que ele aparece. SWAP em vez de acumular: ao entrar
 *     numa nova section, o set anterior FADE OUT e o novo
 *     FADE IN. Seções 1-3 têm 3 avatares cada; seção 4 tem
 *     12 formando um círculo.
 *   - Scroll listener (rAF throttled) detecta qual section
 *     ocupa o centro da viewport.
 *   - Avatares com `circling: true` (todos da seção 4) ganham
 *     animação radial de entrada + drift contínuo sutil.
 *   - Labels podem ser uma string (estática) OU array (cycle
 *     suave com fade entre tracks a cada 4s) — quem decide é
 *     a definição abaixo.
 */

interface AvatarSlot {
  name: string;
  /** Path opcional pra imagem. Sem src → renderiza placeholder
   *  cinza + iniciais (modo wireframe). */
  src?: string;
  /** Estática OU array que cicla com fade. */
  label?: string;
  labels?: string[];
  section: 1 | 2 | 3 | 4;
  circling?: boolean;
  driftDelay?: number;
  style: React.CSSProperties;
}

/* ── Sections 1-3: 3 avatares cada, cantos diferentes ─────── */
const SECTION_AVATARS: AvatarSlot[] = [
  // Section 1 — cantos. Únicos com fotos reais (user-01/02/03);
  // demais sections seguem com placeholder cinza wireframe.
  {
    name: 'Marina',
    src: '/teste/user-01.png',
    labels: [
      'Boiadeira - Ana Castela',
      'Pipoco - Ana Castela',
      'Solto - Ana Castela',
    ],
    section: 1,
    style: { top: '16%', left: '6%' },
  },
  {
    name: 'Rafael',
    src: '/teste/user-02.png',
    labels: [
      'Boiadeira - Ana Castela',
      'Tropa do Chapelão',
      'Rodeio no Texas',
    ],
    section: 1,
    style: { bottom: '20%', left: '4%' },
  },
  {
    name: 'Clara',
    src: '/teste/user-03.png',
    labels: [
      'Pipoco - Ana Castela',
      'Solto - Ana Castela',
      'Boiadeira - Ana Castela',
    ],
    section: 1,
    style: { bottom: '20%', right: '4%' },
  },

  // Section 2 — meios laterais + topo direito
  {
    name: 'Júlia',
    labels: [
      'Solto - Ana Castela',
      'Pipoco - Ana Castela',
      'Tropa do Chapelão',
    ],
    section: 2,
    style: { top: '50%', left: '8%' },
  },
  {
    name: 'Pedro',
    labels: [
      'Pipoco - Ana Castela',
      'Rodeio no Texas',
      'Boiadeira - Ana Castela',
    ],
    section: 2,
    style: { top: '18%', right: '10%' },
  },
  {
    name: 'Camila',
    labels: [
      'Tropa do Chapelão',
      'Solto - Ana Castela',
      'Pipoco - Ana Castela',
    ],
    section: 2,
    style: { top: '54%', right: '12%' },
  },

  // Section 3 — trio fundo + topo centro
  {
    name: 'Heitor',
    labels: [
      'Rodeio no Texas',
      'Boiadeira - Ana Castela',
      'Solto - Ana Castela',
    ],
    section: 3,
    style: { top: '18%', left: '50%' },
  },
  {
    name: 'Lia',
    labels: [
      'Boiadeira - Ana Castela',
      'Pipoco - Ana Castela',
      'Tropa do Chapelão',
    ],
    section: 3,
    style: { bottom: '14%', left: '18%' },
  },
  {
    name: 'Bruno',
    labels: [
      'Solto - Ana Castela',
      'Rodeio no Texas',
      'Pipoco - Ana Castela',
    ],
    section: 3,
    style: { bottom: '18%', right: '20%' },
  },
];

/**
 * Section 4 — 12 avatares formando um GRUPO orgânico ao redor
 * do centro da viewport (não um círculo).
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

function buildCircleSlots(): AvatarSlot[] {
  const count = 15;
  /* maxRadius mais largo (26 → 32vmin) per product feedback
   * "distribua-os mais aos lados da página, pois ao centro
   * irei colocar conteúdos". Avatares ocupam mais espaço
   * lateral, deixando o centro livre. */
  const maxRadius = 32; // vmin
  /* minRadiusFactor sobe de 40% → 65% — TODOS os avatares
   * ficam pelo menos a 65% do raio máximo (longe do centro). */
  const minRadiusFactor = 0.65;

  let seed = 73;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, (_, i) => {
    /* Distribuição lateral: avatares alternam entre band
     * ESQUERDA (centro 180°) e DIREITA (centro 0°), com
     * jitter generoso de ±60°. Nenhum cai no eixo vertical
     * puro — o centro fica livre pra conteúdo futuro.
     *
     * Algorítmo organico: i par → lado esquerdo, i ímpar →
     * direito. Como i percorre 0..14, isso dá 8 left + 7
     * right (≈simétrico). Dentro de cada lado o jitter
     * espalha em arco de 120° (de -60° a +60° do eixo
     * horizontal), permitindo posições ligeiramente acima ou
     * abaixo do centro mas SEMPRE na metade lateral.
     */
    const isLeft = i % 2 === 0;
    const sideCenter = isLeft ? Math.PI : 0;
    const sideJitter = (rng() - 0.5) * ((Math.PI * 2) / 3); // ±60°
    const angle = sideCenter + sideJitter;

    // Raio polarizado pra perimeter (65-100% do max).
    const radiusFactor = minRadiusFactor + rng() * (1 - minRadiusFactor);
    const r = maxRadius * radiusFactor;

    const fx = Math.cos(angle) * r;
    const fy = Math.sin(angle) * r;

    /* CROSSOVER per product feedback "os avatares que entrarem
     * pela esquerda se posicionam flutuante mais à direita e
     * vice-versa".
     *
     * Implementação elegante: o ângulo do ponto INICIAL é 180°
     * oposto ao ângulo final. Se o avatar termina à direita
     * (angle ≈ 0°), entra pela esquerda (startAngle ≈ 180°);
     * se termina em cima-direita (angle = 30°), entra de
     * baixo-esquerda (startAngle = 210°). Diagonais ficam
     * naturalmente representadas.
     *
     * startRadius 70vmax — sempre além das bordas da viewport.
     */
    const startRadius = 70; // vmax
    const startAngle = angle + Math.PI;
    const sx = Math.cos(startAngle) * startRadius;
    const sy = Math.sin(startAngle) * startRadius;

    /* Velocidades MAIS LENTAS per product feedback "a
     * velocidade de entrada e saída dos avatares deve ser
     * menor".
     * - Approach: 3.5-5.5s (era 2.2-3.8s).
     * - Drift idle: 7-11s (era 5.5-8.5s). Curva mais lenta
     *   reforça a "sensação de espaço sem gravidade". */
    const enterDurationMs = 3500 + rng() * 2000;
    const driftDurationSec = 7 + rng() * 4;

    return {
      name: `group-${i}`,
      src: CIRCLE_AVATAR_SRCS[i % CIRCLE_AVATAR_SRCS.length],
      section: 4,
      circling: true,
      driftDelay: rng() * 4,
      style: {
        left: `calc(50% + ${fx.toFixed(2)}vmin - 24px)`,
        top: `calc(50% + ${fy.toFixed(2)}vmin - 24px)`,
        // --circle-tx/ty: delta da posição FINAL até o ponto
        // INICIAL (180° oposto, fora da viewport).
        ['--circle-tx' as string]:
          `calc(${sx.toFixed(2)}vmax - ${fx.toFixed(2)}vmin)`,
        ['--circle-ty' as string]:
          `calc(${sy.toFixed(2)}vmax - ${fy.toFixed(2)}vmin)`,
        ['--enter-duration' as string]: `${Math.round(enterDurationMs)}ms`,
        ['--drift-duration' as string]: `${driftDurationSec.toFixed(2)}s`,
      } as React.CSSProperties,
    };
  });
}

export default function AvatarConstellation() {
  /** Section atualmente ativa (centro da viewport). */
  const [activeSection, setActiveSection] = useState<1 | 2 | 3 | 4>(1);

  /** Circle slots geradas uma vez (memoized pra estabilidade
   *  entre renders + evitar hydration mismatch). */
  const circleSlots = useMemo(() => buildCircleSlots(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let raf = 0;
    function checkActiveSection() {
      const center = window.innerHeight * 0.5;
      let active: 1 | 2 | 3 | 4 = 1;
      for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`section-${i}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= center && r.bottom >= center) {
          active = i as 1 | 2 | 3 | 4;
          break;
        }
      }
      setActiveSection((prev) => (prev === active ? prev : active));
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        checkActiveSection();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    checkActiveSection();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const allSlots = [...SECTION_AVATARS, ...circleSlots];

  return (
    <>
      {allSlots.map((a) => (
        <FloatingAvatar
          key={a.name}
          src={a.src}
          name={a.name}
          label={a.label}
          labels={a.labels}
          size="sm"
          revealed={a.section === activeSection}
          circling={a.circling}
          driftDelay={a.driftDelay}
          style={a.style}
        />
      ))}
    </>
  );
}
