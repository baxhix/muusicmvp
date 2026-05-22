'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Zonas de distribuição — 10 avatares espalhados em 8 zonas
 * pré-definidas, com ÊNFASE NOS CANTOS INFERIORES per product
 * feedback "redistribua os avatares nos espaços que ainda não
 * tem, principalmente nos cantos inferiores de ambos os
 * lados". Bottom-left e bottom-right têm 2 avatares cada (4
 * total). As outras 6 zonas têm 1 cada.
 *
 * Coordenadas em vw (x) e vh (y) — escalam com viewport.
 * Cada zona define [xMin, xMax] × [yMin, yMax].
 */
/**
 * REORDENADO per product feedback "diminua para 4 avatares
 * flutuantes no mobile, pois 10 são muitos".
 *
 * As 4 PRIMEIRAS zonas são os QUATRO CANTOS — usados no
 * mobile (count visível = 4). Ordem: top-left, top-right,
 * bottom-left, bottom-right. Garante distribuição visual
 * balanceada nas 4 extremidades quando só 4 estão visíveis.
 *
 * Zonas 5-10 são as adicionais (edges + cantos extras)
 * usadas no desktop pra chegar a 10 total.
 */
const ZONES: ReadonlyArray<{
  readonly count: number;
  readonly xRange: readonly [number, number];
  readonly yRange: readonly [number, number];
}> = [
  // CANTOS — primeiros 4 (mobile mostra apenas estes).
  { count: 1, xRange: [-40, -28], yRange: [-32, -18] }, // top-left
  { count: 1, xRange: [28, 40],   yRange: [-32, -18] }, // top-right
  { count: 1, xRange: [-40, -26], yRange: [16, 34] },   // bottom-left
  { count: 1, xRange: [26, 40],   yRange: [16, 34] },   // bottom-right
  // EXTRAS — só renderizados no desktop.
  { count: 1, xRange: [-12, 12],  yRange: [-32, -22] }, // top-edge
  { count: 1, xRange: [-40, -28], yRange: [-26, -16] }, // left-edge UPPER
  { count: 1, xRange: [28, 40],   yRange: [16, 26] },   // right-edge LOWER
  { count: 1, xRange: [-12, 12],  yRange: [22, 34] },   // bottom-edge
  { count: 1, xRange: [-40, -26], yRange: [16, 34] },   // bottom-left extra
  { count: 1, xRange: [26, 40],   yRange: [16, 34] },   // bottom-right extra
];
// Soma: 1+1+1+1+1+1+1+1+1+1 = 10 ✓ (4 corners + 6 extras)

function buildFloatingSlots(seed: number): AvatarSlot[] {
  /* Anti-overlap entre avatares — distância min 11 (mixed
   * unit vw/vh, ≈100px em viewport médio). Como as zonas já
   * estão separadas, esse threshold só precisa cuidar de
   * dois avatares no MESMO bottom corner. */
  const minDistance = 11;

  let s = seed;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const positions: Array<{ fx: number; fy: number }> = [];

  for (const zone of ZONES) {
    for (let k = 0; k < zone.count; k++) {
      let attempts = 0;
      while (attempts < 200) {
        attempts++;
        const fx = zone.xRange[0] + rng() * (zone.xRange[1] - zone.xRange[0]);
        const fy = zone.yRange[0] + rng() * (zone.yRange[1] - zone.yRange[0]);
        const tooClose = positions.some(
          (p) => Math.hypot(p.fx - fx, p.fy - fy) < minDistance,
        );
        if (tooClose) continue;
        positions.push({ fx, fy });
        break;
      }
    }
  }

  return positions.map((pos, i) => {
    /* Approach crossover: 180° oposto à posição final. */
    const angle = Math.atan2(pos.fy, pos.fx);
    const startRadius = 70; // vmax
    const startAngle = angle + Math.PI;
    const sx = Math.cos(startAngle) * startRadius;
    const sy = Math.sin(startAngle) * startRadius;

    const enterDurationMs = 3500 + rng() * 2000;
    const driftDurationSec = 7 + rng() * 4;

    return {
      name: `floater-${i}`,
      src: CIRCLE_AVATAR_SRCS[i % CIRCLE_AVATAR_SRCS.length],
      circling: true,
      driftDelay: rng() * 4,
      style: {
        // Posições em vw/vh — escala com viewport real, dando
        // mais spread em desktops largos.
        left: `calc(50% + ${pos.fx.toFixed(2)}vw - 24px)`,
        top: `calc(50% + ${pos.fy.toFixed(2)}vh - 24px)`,
        ['--circle-tx' as string]:
          `calc(${sx.toFixed(2)}vmax - ${pos.fx.toFixed(2)}vw)`,
        ['--circle-ty' as string]:
          `calc(${sy.toFixed(2)}vmax - ${pos.fy.toFixed(2)}vh)`,
        ['--enter-duration' as string]: `${Math.round(enterDurationMs)}ms`,
        ['--drift-duration' as string]: `${driftDurationSec.toFixed(2)}s`,
      } as React.CSSProperties,
    };
  });
}

/**
 * Sets de posições — gerados uma vez com seeds diferentes pra
 * que cada "phase" (a cada 2 sections rolladas) tenha um layout
 * distinto. 3 sets cobrem: phase 0 (sections 1-2), phase 1
 * (sections 3-4), phase 2 (footer). O componente troca entre
 * sets conforme `Math.floor(scrollY / (2 * viewport.height))`,
 * com transição CSS suave de left/top pra dar a sensação de
 * MOVIMENTO contínuo na experiência. Per product feedback "a
 * cada duas seções, mude os avatares de lugar para dar ainda
 * mais movimento na experiência".
 */
const FLOATING_SLOT_SEEDS = [73, 167, 251];

/**
 * Mapeamento section → phase per product feedback:
 *   - Hero (section 1): phase 0 — set A inicial.
 *   - Section 2 + 3: phase 1 — set B (primeira mudança).
 *   - Section 4 + 5 + 6 + footer: phase 2 — set C (segunda mudança).
 *
 * Avatares ficam sempre visíveis (no Hero já estão visíveis e
 * flutuantes; nunca desaparecem, nem no footer).
 */
function sectionToPhase(sectionIdx: number): number {
  if (sectionIdx <= 1) return 0;
  if (sectionIdx <= 3) return 1;
  return 2;
}

/** Pequeno delay (ms) entre detectar mudança de section e
 *  aplicar o novo phase per "acompanham o scroll com um
 *  pequeno delay". */
const PHASE_DELAY_MS = 350;

/** Breakpoint mobile pro count de avatares. */
const MOBILE_BREAKPOINT_PX = 720;

export default function AvatarConstellation() {
  const [phase, setPhase] = useState(0);
  const [targetPhase, setTargetPhase] = useState(0);

  /**
   * Max count responsivo per product feedback "diminua para 4
   * avatares flutuantes no mobile, pois 10 são muitos". 4 em
   * mobile (≤720px), 10 em desktop. As 4 primeiras zonas
   * estão ordenadas como CANTOS (top-left/right + bottom-
   * left/right) — distribuição balanceada mesmo com apenas
   * 4 visíveis.
   */
  const [maxCount, setMaxCount] = useState(10);

  const [visibleCount, setVisibleCount] = useState(0);

  /** Parallax scroll: -px = avatar sobe (acompanhando conteúdo
   *  pra cima); recovers para 0 (desce de volta) per "ao
   *  fazer scroll os avatares sobem junto com o conteúdo, mas
   *  após um delay eles descem para acompanhar o scroll". */
  const [parallaxY, setParallaxY] = useState(0);
  const parallaxRef = useRef(0);

  const slotSets = useMemo(
    () => FLOATING_SLOT_SEEDS.map(buildFloatingSlots),
    [],
  );

  const currentSet = slotSets[phase % slotSets.length];

  // Detect viewport pra decidir count máximo (mobile = 4).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => {
      setMaxCount(window.innerWidth <= MOBILE_BREAKPOINT_PX ? 4 : 10);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Staggered reveal — UM avatar por vez, cascading. Roda até
  // maxCount (4 mobile, 10 desktop). Se viewport mudar
  // durante o stagger, o effect refaz os timers com o novo
  // limite.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const startDelay = 500;
    const intervalMs = 350;

    for (let n = 1; n <= maxCount; n++) {
      const delay = startDelay + (n - 1) * intervalMs;
      timers.push(setTimeout(() => setVisibleCount(n), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [maxCount]);

  // Scroll listener: phase detection + parallax inertia.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let raf = 0;
    let decayRaf = 0;
    let prevScrollY = window.scrollY;

    function decayLoop() {
      parallaxRef.current *= 0.86;
      if (Math.abs(parallaxRef.current) < 0.3) {
        parallaxRef.current = 0;
        setParallaxY(0);
        decayRaf = 0;
        return;
      }
      setParallaxY(parallaxRef.current);
      decayRaf = requestAnimationFrame(decayLoop);
    }

    function check() {
      const vh = window.innerHeight;
      const center = vh * 0.5;

      // -- Phase: qual section ocupa o centro do viewport.
      let active = 1;
      for (let i = 1; i <= 6; i++) {
        const el = document.getElementById(`section-${i}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= center && r.bottom > center) {
          active = i;
          break;
        }
      }
      const footer = document.querySelector('footer');
      if (footer) {
        const fr = footer.getBoundingClientRect();
        if (fr.top <= center) active = 7;
      }

      const nextTargetPhase = sectionToPhase(active);
      setTargetPhase((prev) =>
        prev === nextTargetPhase ? prev : nextTargetPhase,
      );

      // -- Parallax: aplica delta do scroll ao offset.
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - prevScrollY;
      prevScrollY = currentScrollY;
      // Scroll DOWN (delta > 0): parallax fica NEGATIVO →
      // avatares "sobem com o conteúdo" (CSS: translateY
      // negativo = sobe). Factor 0.55 atenua o efeito —
      // avatares não acompanham 1:1 o scroll, só insinuam.
      parallaxRef.current = Math.max(
        -90,
        Math.min(90, parallaxRef.current - delta * 0.55),
      );
      setParallaxY(parallaxRef.current);

      // Kickoff decay (RAF loop que volta o offset pra 0).
      if (!decayRaf) decayRaf = requestAnimationFrame(decayLoop);
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
      if (decayRaf) cancelAnimationFrame(decayRaf);
    };
  }, []);

  // Aplica targetPhase após o delay.
  useEffect(() => {
    if (targetPhase === phase) return;
    const t = setTimeout(() => setPhase(targetPhase), PHASE_DELAY_MS);
    return () => clearTimeout(t);
  }, [targetPhase, phase]);

  // Slice pra renderizar apenas maxCount avatares (4 mobile, 10 desktop).
  const visibleSet = currentSet.slice(0, maxCount);

  return (
    <>
      {visibleSet.map((a, i) => (
        <FloatingAvatar
          key={a.name}
          src={a.src}
          name={a.name}
          size="sm"
          revealed={i < visibleCount}
          circling={a.circling}
          driftDelay={a.driftDelay}
          style={{
            ...a.style,
            ['--parallax-y' as string]: `${parallaxY.toFixed(1)}px`,
          }}
        />
      ))}
    </>
  );
}
