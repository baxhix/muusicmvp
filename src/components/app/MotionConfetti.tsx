'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

/**
 * MotionConfetti — confetti burst usando motion/react no lugar
 * de canvas-confetti.
 *
 * Params (per product spec):
 *   particleCount 71
 *   startVelocity 37
 *   spread        36
 *   decay         1
 *   gravity       1
 *   duration      3 (segundos)
 *
 * Arquitetura:
 *   - Componente mountado UMA vez no app shell, escuta o
 *     CustomEvent `app:motion-confetti`. Cada call empurra um
 *     "burst" no state local; AnimatePresence cleanup ao fim
 *     da `duration`.
 *   - Cada burst renderiza N partículas (motion.div) com
 *     posição inicial igual ao `origin` (0–1 viewport coords),
 *     velocidade inicial decomposta no cone do `spread`, e
 *     trajetória final pré-computada via física balística
 *     (vx*t, vy*t + 0.5*g*t²). Motion interpola via spring/
 *     tween — animação roda na GPU (transform-only).
 *   - Portal pra body → flutua acima de qualquer overlay /
 *     stacking context. pointer-events: none no wrapper pra
 *     nunca interceptar cliques.
 *   - Respect `prefers-reduced-motion`: bursts viram fade
 *     único sem disparar trajetórias (mantém affordance
 *     sem náusea visual).
 *
 * API pública:
 *   fireMotionConfetti({ origin?, colors? }) — dispara um
 *   burst com os params padrão. `origin` em coords viewport
 *   normalizadas {x, y} (0–1, default {0.5, 0.6}).
 */

const PARTICLE_COUNT = 71;
const START_VELOCITY = 37;
const SPREAD_DEG = 36;
/* decay = 1 (canvas-confetti convention: 1 = sem decay).
 *  Aqui ignoramos decay no cálculo de trajetória (decay 1
 *  significa que a velocity não decai por tick). */
const GRAVITY = 1;
const DURATION_S = 3;

/* Brand palette espelhada de Achievement/FeedCelebration. */
const DEFAULT_COLORS = [
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#0284C7', // sky
  '#0F766E', // teal
  '#15803D', // green
  '#D97706', // amber
  '#DC2626', // red
  '#DB2777', // pink
  '#3DDB74', // accent
];

/* Scale factor pra converter os params do canvas-confetti
 *  (que pensam em "ticks" 60fps) pra pixels de viewport.
 *  startVelocity * VELOCITY_PX_PER_UNIT * duration ≈ alcance
 *  máximo em pixels. Calibrado pra reach ~600px com vel=37
 *  e duration=3s — preenche um terço da tela vertical em
 *  desktop / metade no mobile, que é o que canvas-confetti
 *  fazia visualmente antes. */
const VELOCITY_PX_PER_UNIT = 5.5;
/* Gravity scale — quanto cada unit de gravity puxa por
 *  segundo² em pixels. canvas-confetti default gravity=1
 *  derruba ~600px em 3s, então gravity_px ≈ 133 px/s². */
const GRAVITY_PX_PER_UNIT = 133;

export interface MotionConfettiFireOptions {
  /** Origin do burst em viewport-normalized coords (0–1).
   *  Default: centro horizontal, 60% da altura. */
  origin?: { x: number; y: number };
  /** Override do palette. Default: brand colors. */
  colors?: string[];
}

interface Particle {
  id: string;
  color: string;
  /** Posição final relativa ao origin, em pixels. */
  dx: number;
  dy: number;
  /** Rotação final em graus (random per particle). */
  rotateEnd: number;
  /** Shape (square / rect) — visual variety. */
  width: number;
  height: number;
  /** Delay infinitesimal pra escalonar a saída e evitar
   *  todas partículas saindo no exatamente mesmo frame. */
  delay: number;
}

interface Burst {
  id: string;
  /** Pixel position do origin no viewport (não normalized). */
  originPx: { x: number; y: number };
  particles: Particle[];
}

/** Computa partículas de UM burst usando os params globais
 *  + cone do spread + física balística simples. */
function buildParticles(colors: string[]): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    /* Cone centrado em "up" (-PI/2 em screen coords).
     *  spread/2 em cada lado. */
    const spreadHalfRad = (SPREAD_DEG / 2) * (Math.PI / 180);
    const angleRad =
      -Math.PI / 2 + (Math.random() * 2 - 1) * spreadHalfRad;
    /* Velocidade inicial decomposta. Pequena variação
     *  per particle (±15%) pra evitar look "perfeito". */
    const v = START_VELOCITY * (0.85 + Math.random() * 0.3);
    const vx0 = v * Math.cos(angleRad) * VELOCITY_PX_PER_UNIT;
    const vy0 = v * Math.sin(angleRad) * VELOCITY_PX_PER_UNIT;
    /* Trajetória final em t = DURATION_S:
     *  dx = vx0 * t
     *  dy = vy0 * t + 0.5 * g * t²  (Y aumenta pra baixo) */
    const dx = vx0 * DURATION_S;
    const dy =
      vy0 * DURATION_S +
      0.5 * GRAVITY * GRAVITY_PX_PER_UNIT * DURATION_S * DURATION_S;

    particles.push({
      id: `${i}`,
      color: colors[i % colors.length],
      dx,
      dy,
      rotateEnd: (Math.random() * 6 - 3) * 360,
      /* Mix de quadrados (8x8) e retângulos (10x4) — papel
       *  picado clássico. */
      width: Math.random() > 0.5 ? 8 : 10,
      height: Math.random() > 0.5 ? 8 : 4,
      delay: Math.random() * 0.05,
    });
  }
  return particles;
}

/** Dispara um burst global. Pode ser chamado de qualquer
 *  lugar — o componente montado no layout escuta. */
export function fireMotionConfetti(opts: MotionConfettiFireOptions = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<MotionConfettiFireOptions>('app:motion-confetti', {
      detail: opts,
    }),
  );
}

export default function MotionConfetti() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [mounted, setMounted] = useState(false);
  /* prefers-reduced-motion: respeitamos via fade-only fallback. */
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail =
        (e as CustomEvent<MotionConfettiFireOptions>).detail ?? {};
      const origin = detail.origin ?? { x: 0.5, y: 0.6 };
      const colors = detail.colors ?? DEFAULT_COLORS;
      const originPx = {
        x: origin.x * window.innerWidth,
        y: origin.y * window.innerHeight,
      };
      const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const burst: Burst = {
        id,
        originPx,
        particles: buildParticles(colors),
      };
      setBursts((prev) => [...prev, burst]);
      /* Auto-cleanup depois da duração + buffer. Buffer
       *  pequeno pra AnimatePresence rodar exit sem ser
       *  cortado. */
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, DURATION_S * 1000 + 200);
    };
    window.addEventListener('app:motion-confetti', handler);
    return () => window.removeEventListener('app:motion-confetti', handler);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        /* z-index acima de qualquer modal/overlay. */
        zIndex: 9999,
        /* Overflow hidden previne scrollbar quando partículas
         *  saem da viewport. */
        overflow: 'hidden',
      }}
    >
      <AnimatePresence>
        {bursts.map((burst) => (
          <BurstLayer
            key={burst.id}
            burst={burst}
            reducedMotion={reducedMotion}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

interface BurstLayerProps {
  burst: Burst;
  reducedMotion: boolean;
}

function BurstLayer({ burst, reducedMotion }: BurstLayerProps) {
  return (
    <>
      {burst.particles.map((p) => (
        <motion.div
          key={`${burst.id}-${p.id}`}
          initial={{
            x: burst.originPx.x,
            y: burst.originPx.y,
            opacity: 1,
            rotate: 0,
            scale: reducedMotion ? 0 : 1,
          }}
          animate={{
            /* Posição final em pixels absolutos no viewport
             *  (já contabilizou origin no initial). */
            x: burst.originPx.x + p.dx,
            y: burst.originPx.y + p.dy,
            opacity: 0,
            rotate: p.rotateEnd,
            scale: reducedMotion ? 0 : 1,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: DURATION_S,
            delay: p.delay,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: 1,
            willChange: 'transform, opacity',
            /* Translate (-50%, -50%) implícito via initial/animate
             *  começando direto no centro do origin — Motion
             *  controla via x/y absolutos. */
          }}
        />
      ))}
    </>
  );
}
