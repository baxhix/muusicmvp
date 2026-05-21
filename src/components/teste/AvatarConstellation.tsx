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
 * Section 4 — 12 avatares formando um círculo "imperfeito"
 * (jitter ±2vmin) ao redor do centro da viewport. Cada um:
 *   - Posicionado em ângulo `i * 30°` ao redor do center.
 *   - Tem `circling: true` → slide-in radial do exterior pro
 *     spot final (translates `--circle-tx/--circle-ty` quando
 *     hidden).
 *   - Pós-reveal: ganha drift sutil (animation com translate
 *     CSS property, independente do transform usado no
 *     reveal).
 *   - `driftDelay` único pra dessincronizar a respiração.
 *   - Sem labels — o foco da seção é a formação visual.
 *
 * Math:
 *   - Radius = 26vmin (escala com a menor dim. da viewport).
 *   - Approach distance = +60% do raio (pushed outward
 *     quando hidden).
 *   - Final pos: `left: calc(50% + cos(angle) * 26vmin - 24px)`
 *     (-24px = metade do avatar sm 48px pra centralizar).
 *   - Jitter: ±1.5vmin no raio + ±6° no ângulo, com seed
 *     determinístico pra evitar hydration mismatch.
 */
function buildCircleSlots(): AvatarSlot[] {
  const count = 12;
  const radius = 26; // vmin
  const approachExtra = radius * 0.6; // 60% mais longe quando hidden
  // RNG determinístico pra jitter (mulberry32 simplificado).
  let seed = 73;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, (_, i) => {
    const baseAngle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const angleJitter = (rng() - 0.5) * (Math.PI / 30); // ±6°
    const radiusJitter = (rng() - 0.5) * 3; // ±1.5vmin
    const angle = baseAngle + angleJitter;
    const r = radius + radiusJitter;
    const fx = Math.cos(angle) * r;
    const fy = Math.sin(angle) * r;
    // Approach (start) position pushed outward radialmente.
    const ax = Math.cos(angle) * approachExtra;
    const ay = Math.sin(angle) * approachExtra;

    return {
      name: `circle-${i}`,
      // Sem label — Section 4 é puro visual.
      section: 4,
      circling: true,
      driftDelay: rng() * 4, // 0-4s pra desincronizar
      style: {
        left: `calc(50% + ${fx.toFixed(2)}vmin - 24px)`,
        top: `calc(50% + ${fy.toFixed(2)}vmin - 24px)`,
        // CSS vars consumidas pelo .circling.hidden no CSS
        // module — o transform vai pra essa direção quando o
        // avatar está pré-reveal.
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
