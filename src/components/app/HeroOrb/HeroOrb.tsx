'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import styles from './HeroOrb.module.css';

/**
 * HeroOrb — premium flowing-ribbon sphere.
 *
 * Renders a tangle of luminous curves wrapping a noise-deformed
 * sphere, with light "pulses" flowing along each curve — same
 * silk-ribbon energy the inspiration image captures. Built with
 * raw Three.js (the project already ships three@0.149 and a
 * single 70x70 component doesn't justify adding R3F).
 *
 * Topology
 *  • N closed curves on the unit sphere. Each curve is a tilted
 *    great-circle (random orthogonal basis) with a slight radius
 *    variation so the rings don't all share the orb's surface
 *    pixel-perfect. Vertices are sampled around each ring at
 *    uniform parametric spacing.
 *  • Each vertex carries:
 *      - aT          → [0,1) position along its curve
 *      - aPathSeed   → random [0,1) per CURVE, drives independent
 *                      color phases + flow offsets
 *  • LineSegments index buffer pairs adjacent vertices and closes
 *    the loop (last → first). Each curve becomes a closed ring.
 *
 * Animation
 *  • Vertex shader applies layered Ashima 3D simplex noise to each
 *    vertex along its radial axis (same algorithm as before so
 *    adjacent vertices displace consistently and the ribbons
 *    never tear).
 *  • Fragment shader runs a sine wave of brightness along each
 *    curve (parametric position `aT` minus time), staggered per
 *    curve via pathSeed → a bright crest travels around each
 *    ribbon like an LED chase. This is the "flow" effect.
 *  • Color cycles the 3-stop purple/magenta/orange palette per
 *    curve.
 *  • Parent THREE.LineSegments rotates slowly on Y + sin-modulated
 *    on X so the whole tangle also drifts in space.
 *
 * Performance + lifecycle
 *  • IntersectionObserver pauses the rAF when offscreen.
 *  • prefers-reduced-motion drops uSpeed to a near-static value.
 *  • All Three resources are dispose()d on unmount.
 *  • DPR capped at 2 — backing canvas at 70 CSS px renders at max
 *    140x140.
 */

interface HeroOrbProps {
  /** Render footprint in CSS px (square). */
  size?: number;
  /** How many ribbons wrap the orb. 8-14 reads well at 70×70;
   *  bigger sizes can push to 20+. Each curve becomes a visible
   *  flowing strand, so more = denser tangle, fewer = airier. */
  curveCount?: number;
  /** Vertices sampled around each ring. Higher = smoother curves
   *  but more draw calls. 60-100 is the sweet spot. */
  verticesPerCurve?: number;
  /** Time multiplier for the noise + rotation + flow + color cycle. */
  speed?: number;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  enableMouseInteraction?: boolean;
  className?: string;
  ariaLabel?: string;
}

const DEFAULTS = {
  size: 120,
  // Denser tangle (was 11/80) so the wireframe-sphere outline reads
  // clearly at the larger default size. Each extra curve is ~80
  // line segments — the bigger Three.js draw still fits inside one
  // additive-blended LineSegments call, so the perf cost is small.
  curveCount: 16,
  verticesPerCurve: 96,
  speed: 1,
  // Magenta-dominant palette per product feedback (the reference
  // is a hot pink + violet plasma orb — the previous orange accent
  // pulled the look too far toward sunset, away from the brief).
  // Three stops still cycle through the curve color phase but they
  // all sit in the pink/violet range now.
  colors: {
    primary:   '#a855f7', // violet-500 — base tangle hue
    secondary: '#ec4899', // pink-500 — mid color
    accent:    '#f43f5e', // rose-500 — the bright glowing red on the rim
  },
  enableMouseInteraction: true,
};

/**
 * Build the flowing-curve network geometry.
 *
 * Returns positions + parametric attribute + index buffers. The
 * topology is fixed for the lifetime of the component — only the
 * per-vertex deformation in the shader animates.
 */
function buildFlowingCurves(
  curveCount: number,
  verticesPerCurve: number,
): {
  positions: Float32Array;
  aT: Float32Array;
  aPathSeed: Float32Array;
  indices: Uint16Array;
} {
  const totalVertices = curveCount * verticesPerCurve;
  const positions  = new Float32Array(totalVertices * 3);
  const aT         = new Float32Array(totalVertices);
  const aPathSeed  = new Float32Array(totalVertices);
  // Each curve is a closed loop with `verticesPerCurve` segments,
  // each contributing 2 indices. Total = curveCount * vpc * 2.
  const indices = new Uint16Array(curveCount * verticesPerCurve * 2);

  let vi = 0; // vertex cursor
  let ii = 0; // index cursor

  const u = new THREE.Vector3();
  const v = new THREE.Vector3();

  /** Random unit vector (uniform distribution on the sphere). */
  const randomDir = (out: THREE.Vector3) => {
    // Marsaglia (1972) method — gives uniform sphere sampling.
    let x1 = 0, x2 = 0, s = 2;
    while (s >= 1) {
      x1 = Math.random() * 2 - 1;
      x2 = Math.random() * 2 - 1;
      s = x1 * x1 + x2 * x2;
    }
    const factor = 2 * Math.sqrt(1 - s);
    out.set(x1 * factor, x2 * factor, 1 - 2 * s);
    return out;
  };

  for (let c = 0; c < curveCount; c++) {
    // Pick two random orthogonal unit vectors — they span the
    // plane of this curve's great circle. v is orthogonalized
    // against u via Gram-Schmidt.
    randomDir(u);
    randomDir(v);
    v.addScaledVector(u, -v.dot(u)).normalize();

    // Slight per-curve radius variation so the rings don't all
    // sit on the same sphere surface — adds visual depth.
    const radius = 0.92 + Math.random() * 0.12;
    const pathSeed = Math.random();
    const startVertex = vi;

    for (let i = 0; i < verticesPerCurve; i++) {
      const t = i / verticesPerCurve;
      const angle = t * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      positions[vi * 3]     = (u.x * cosA + v.x * sinA) * radius;
      positions[vi * 3 + 1] = (u.y * cosA + v.y * sinA) * radius;
      positions[vi * 3 + 2] = (u.z * cosA + v.z * sinA) * radius;
      aT[vi]        = t;
      aPathSeed[vi] = pathSeed;
      vi++;
    }

    // Emit `verticesPerCurve` segment pairs closing the ring:
    // (start, start+1), (start+1, start+2), …, (start+last, start).
    for (let i = 0; i < verticesPerCurve; i++) {
      const a = startVertex + i;
      const b = startVertex + ((i + 1) % verticesPerCurve);
      indices[ii++] = a;
      indices[ii++] = b;
    }
  }

  return { positions, aT, aPathSeed, indices };
}

export default function HeroOrb({
  size = DEFAULTS.size,
  curveCount = DEFAULTS.curveCount,
  verticesPerCurve = DEFAULTS.verticesPerCurve,
  speed = DEFAULTS.speed,
  colors = DEFAULTS.colors,
  enableMouseInteraction = DEFAULTS.enableMouseInteraction,
  className,
  ariaLabel = 'Animação decorativa',
}: HeroOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const speedRef = useRef(speed);
  const pausedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const mouseInteractionRef = useRef(enableMouseInteraction);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { mouseInteractionRef.current = enableMouseInteraction; }, [enableMouseInteraction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.z = 4.6;

    /* ── Build geometry ──────────────────────────────────── */
    const { positions, aT, aPathSeed, indices } = buildFlowingCurves(
      curveCount,
      verticesPerCurve,
    );

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',  new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aT',        new THREE.BufferAttribute(aT, 1));
    geometry.setAttribute('aPathSeed', new THREE.BufferAttribute(aPathSeed, 1));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const colA = new THREE.Color(colors.primary   ?? DEFAULTS.colors.primary);
    const colB = new THREE.Color(colors.secondary ?? DEFAULTS.colors.secondary);
    const colC = new THREE.Color(colors.accent    ?? DEFAULTS.colors.accent);

    const material = new THREE.ShaderMaterial({
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime:      { value: 0 },
        uSpeed:     { value: speed },
        uMouse:     { value: new THREE.Vector2(0, 0) },
        uIntensity: { value: 1.0 },
        uColorA:    { value: colA },
        uColorB:    { value: colB },
        uColorC:    { value: colC },
      },
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
      blending:    THREE.AdditiveBlending,
    });

    const lines = new THREE.LineSegments(geometry, material);
    scene.add(lines);

    /* ── Mouse parallax ──────────────────────────────────── */
    const targetMouse = new THREE.Vector2();
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseInteractionRef.current) return;
      targetMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      targetMouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    /* ── Pause when offscreen ──────────────────────────── */
    const io = new IntersectionObserver(
      ([entry]) => { pausedRef.current = !entry.isIntersecting; },
      { threshold: 0 },
    );
    io.observe(canvas);

    /* ── Reduced motion ────────────────────────────────── */
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionMq.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    motionMq.addEventListener('change', onMotionChange);

    /* ── rAF loop ──────────────────────────────────────── */
    const clock = new THREE.Clock();
    let rafId = 0;
    let smoothedMouseX = 0;
    let smoothedMouseY = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (pausedRef.current) return;

      const t = clock.getElapsedTime();
      const effSpeed = reducedMotionRef.current ? 0.15 : speedRef.current;

      material.uniforms.uTime.value  = t;
      material.uniforms.uSpeed.value = effSpeed;

      smoothedMouseX += (targetMouse.x - smoothedMouseX) * 0.07;
      smoothedMouseY += (targetMouse.y - smoothedMouseY) * 0.07;
      material.uniforms.uMouse.value.set(smoothedMouseX, smoothedMouseY);

      // Faster rotation per product feedback — the previous 0.16
      // rad/s read as a slow drift; bumped to 0.42 so the wireframe
      // sphere visibly rolls under the bright flow pulses. X-axis
      // sinusoid amplitude widened from 0.20 → 0.32 and frequency
      // sped up so the orb also visibly tumbles.
      lines.rotation.y = t * 0.42 * effSpeed;
      lines.rotation.x = Math.sin(t * 0.18) * 0.32;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      io.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      motionMq.removeEventListener('change', onMotionChange);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, curveCount, verticesPerCurve, colors.primary, colors.secondary, colors.accent]);

  return (
    <div
      className={`${styles.wrap} ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        aria-label={ariaLabel}
        className={styles.canvas}
      />
    </div>
  );
}
