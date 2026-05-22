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

function buildFloatingSlots(seed: number): AvatarSlot[] {
  /* Count reduzido de 15 → 10 per product feedback "oculte 5
   * para ficar menos carregado de informações a página". */
  const count = 10;

  /* Distribuição INORGÂNICA, MAIS ESPALHADA, sem forma
   * geométrica. Per product feedback "no desktop, espalhe
   * ainda mais os avatares quando estão flutuantes. O centro
   * deve ficar sempre livre".
   *
   * Mudança principal vs versão anterior: usar `vw` no eixo
   * horizontal e `vh` no eixo vertical (em vez de vmin), pra
   * que em desktops largos os avatares ocupem mais a borda
   * lateral da viewport (que vmin não acompanha — vmin é
   * limitado pela menor dimensão).
   *
   * Regras de aceitação:
   *   1. ao menos UM eixo deve estar "extremo" — |fx| > 30vw
   *      OU |fy| > 26vh. Isso garante uma ZONA CENTRAL LIVRE
   *      de 60vw x 52vh — pelo menos 768x468px num viewport
   *      1280x900 — disponível pra conteúdo.
   *   2. anti-overlap: distância mínima de 12 (mixed-units,
   *      ≈12% do viewport).
   *
   * Limites externos: |fx| <= 40vw (final x dentro de 10vw
   * de cada borda lateral); |fy| <= 38vh (final y dentro de
   * 12vh de cada borda V — folga pro header e footer).
   *
   * `seed` parametrizado: permite gerar SETS diferentes de
   * posições pra rotação a cada 2 sections (ver phase system
   * no componente).
   */
  const maxX = 40; // vw
  const maxY = 38; // vh
  const extremeXThreshold = 30; // vw
  const extremeYThreshold = 26; // vh
  const minDistance = 12; // mixed unit

  let s = seed;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
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

    // Regra 1: perto de alguma borda
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

export default function AvatarConstellation() {
  const [phase, setPhase] = useState(0);
  /** targetPhase é o phase derivado do scroll diretamente —
   *  `phase` segue ele com o delay. */
  const [targetPhase, setTargetPhase] = useState(0);

  /** Pré-computa 3 sets de posições determinísticos. */
  const slotSets = useMemo(
    () => FLOATING_SLOT_SEEDS.map(buildFloatingSlots),
    [],
  );

  const currentSet = slotSets[phase % slotSets.length];

  // Scroll listener: detecta qual section ocupa o centro do
  // viewport e mapeia pra phase.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let raf = 0;
    function check() {
      const vh = window.innerHeight;
      const center = vh * 0.5;

      // Procura section ativa (com center da viewport dentro).
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
      // Footer no centro? Trata como section 7 (mas mapa pro
      // phase 2 igual section 4+).
      const footer = document.querySelector('footer');
      if (footer) {
        const fr = footer.getBoundingClientRect();
        if (fr.top <= center) active = 7;
      }

      const nextTargetPhase = sectionToPhase(active);
      setTargetPhase((prev) =>
        prev === nextTargetPhase ? prev : nextTargetPhase,
      );
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

  // Aplica o targetPhase após o delay — gera o "pequeno delay"
  // mencionado no feedback (scroll detecta nova section, mas o
  // movimento de avatares acontece ~350ms depois).
  useEffect(() => {
    if (targetPhase === phase) return;
    const t = setTimeout(() => setPhase(targetPhase), PHASE_DELAY_MS);
    return () => clearTimeout(t);
  }, [targetPhase, phase]);

  return (
    <>
      {currentSet.map((a) => (
        <FloatingAvatar
          // Key SEM phase — avatares persistem entre mudanças
          // de phase. A transição de left/top do .wrap leva
          // os avatares pras novas posições suavemente, sem
          // remount nem sweep.
          key={a.name}
          src={a.src}
          name={a.name}
          size="sm"
          revealed
          circling={a.circling}
          driftDelay={a.driftDelay}
          style={a.style}
        />
      ))}
    </>
  );
}
