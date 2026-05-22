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
  // Section 1 — cantos
  {
    name: 'Marina',
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
function buildCircleSlots(): AvatarSlot[] {
  const count = 12;
  const maxRadius = 26; // vmin (limite externo do grupo)
  const minRadiusFactor = 0.4; // 40% — quem fica mais perto do centro
  let seed = 73;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, (_, i) => {
    // Ângulo base distribuído (30° entre vizinhos) com jitter
    // grande pra quebrar o ritmo — alguns ficam quase juntos.
    const baseAngle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const angleJitter = (rng() - 0.5) * (Math.PI / 6); // ±15°
    const angle = baseAngle + angleJitter;

    // Raio aleatório no range minRadiusFactor..1.0 — alguns
    // perto do centro, outros na "casca". Distribuição
    // uniforme: chance igual de cair em qualquer distância
    // (não viesado pra borda nem centro).
    const radiusFactor = minRadiusFactor + rng() * (1 - minRadiusFactor);
    const r = maxRadius * radiusFactor;

    const fx = Math.cos(angle) * r;
    const fy = Math.sin(angle) * r;
    // Approach: pushed pra fora radialmente +60% do raio
    // INDIVIDUAL — quem está perto do centro slide um pouco;
    // quem está longe slide mais. Mantém o sentido visual.
    const approachFactor = 1.6;
    const ax = Math.cos(angle) * r * (approachFactor - 1);
    const ay = Math.sin(angle) * r * (approachFactor - 1);

    return {
      name: `group-${i}`,
      section: 4,
      circling: true,
      driftDelay: rng() * 4,
      style: {
        left: `calc(50% + ${fx.toFixed(2)}vmin - 24px)`,
        top: `calc(50% + ${fy.toFixed(2)}vmin - 24px)`,
        ['--circle-tx' as string]: `${ax.toFixed(2)}vmin`,
        ['--circle-ty' as string]: `${ay.toFixed(2)}vmin`,
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
