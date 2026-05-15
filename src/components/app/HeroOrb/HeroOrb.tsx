'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import styles from './HeroOrb.module.css';

/**
 * HeroOrb — premium abstract line-network sphere.
 *
 * Renders an animated wireframe-like sphere made of glowing lines
 * that morph with simplex noise and cycle through a purple →
 * magenta → orange palette. Built with raw Three.js (the project
 * already ships three@0.149, and a single 70x70 component doesn't
 * justify adding R3F + postprocessing for ~250kb).
 *
 * Topology
 *  • Generate N base points on a unit sphere (spherical Fibonacci —
 *    even distribution without polar pinching).
 *  • For each point, find its 3 nearest neighbors. Connect them
 *    with line segments. Dedupe undirected pairs so the segment
 *    list is the true edge set of the "neural sphere" network.
 *  • Each vertex inherits an `aLineId` attribute identifying which
 *    segment it belongs to — the fragment shader uses that id to
 *    drive its dynamic color phase.
 *
 * Animation
 *  • Vertex shader applies layered Ashima 3D simplex noise to each
 *    vertex along its radial axis. Both endpoints of a segment
 *    share the same basePos chord, so they displace together and
 *    the segment never tears.
 *  • The parent THREE.LineSegments rotates on Y at a slow constant
 *    rate; X is sin-modulated for asymmetric movement.
 *  • Each line's color cycles independently through the palette via
 *    `fract(lineId * k + time)` — over a long enough loop, the
 *    swarm always shows balanced color distribution.
 *
 * Performance + lifecycle
 *  • IntersectionObserver pauses the rAF when offscreen.
 *  • prefers-reduced-motion drops uSpeed to a near-static value.
 *  • All three resources are dispose()d on unmount.
 *  • DPR capped at 2 — backing canvas at 70 CSS px renders at
 *    140x140 max.
 */

interface HeroOrbProps {
  /** Render footprint in CSS px (square). */
  size?: number;
  /** Approximate number of base points on the sphere. Each point
   *  generates ~3 line segments, so the visible segment count is
   *  roughly 3× this value. */
  baseNodes?: number;
  /** Time multiplier for the noise + rotation + color cycle. */
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
  size: 70,
  baseNodes: 110,
  speed: 1,
  colors: {
    primary:   '#9333ea', // violet-600
    secondary: '#ec4899', // pink-500
    accent:    '#fb923c', // orange-400
  },
  enableMouseInteraction: true,
};

/** Number of nearest neighbours each base point connects to. 3 is
 *  the sweet spot: enough to feel like a network, sparse enough
 *  that individual lines stay visible at 70x70. Bumping to 4 makes
 *  the orb look more like a triangulated mesh. */
const NEIGHBOURS_PER_NODE = 3;

/**
 * Build the line-network geometry.
 *
 * Returns positions + per-vertex line ids ready to feed into a
 * BufferGeometry on a LineSegments. Computed once at mount because
 * the topology never changes — only the per-vertex displacement
 * in the shader does.
 */
function buildLineNetwork(baseNodeCount: number): {
  positions: Float32Array;
  lineIds: Float32Array;
  segmentCount: number;
} {
  // 1) Spherical Fibonacci layout for the base nodes.
  const nodes: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < baseNodeCount; i++) {
    const y = 1 - (i / (baseNodeCount - 1)) * 2; // [-1, 1]
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    nodes.push(
      new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r),
    );
  }

  // 2) For each node, find its NEIGHBOURS_PER_NODE nearest neighbours
  //    by squared distance. Pure O(n²) — fine for n ≤ ~300; for a
  //    real-time-built larger network we'd switch to a k-d tree.
  const pairs = new Set<string>();
  const segments: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (let i = 0; i < nodes.length; i++) {
    const distances: Array<{ j: number; d2: number }> = [];
    for (let j = 0; j < nodes.length; j++) {
      if (j === i) continue;
      distances.push({ j, d2: nodes[i].distanceToSquared(nodes[j]) });
    }
    distances.sort((a, b) => a.d2 - b.d2);
    for (let k = 0; k < NEIGHBOURS_PER_NODE; k++) {
      const j = distances[k]?.j;
      if (j === undefined) break;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      segments.push([nodes[i], nodes[j]]);
    }
  }

  // 3) Pack into typed arrays. Each segment = 2 vertices * 3 floats.
  const positions = new Float32Array(segments.length * 6);
  const lineIds = new Float32Array(segments.length * 2);
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    positions[i * 6]     = a.x;
    positions[i * 6 + 1] = a.y;
    positions[i * 6 + 2] = a.z;
    positions[i * 6 + 3] = b.x;
    positions[i * 6 + 4] = b.y;
    positions[i * 6 + 5] = b.z;
    lineIds[i * 2]     = i;
    lineIds[i * 2 + 1] = i;
  }

  return { positions, lineIds, segmentCount: segments.length };
}

export default function HeroOrb({
  size = DEFAULTS.size,
  baseNodes = DEFAULTS.baseNodes,
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
      antialias: true, // line edges benefit from MSAA at this size
      powerPreference: 'low-power',
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.z = 4.6;

    /* ── Build geometry ──────────────────────────────────────── */
    const { positions, lineIds } = buildLineNetwork(baseNodes);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aLineId',  new THREE.BufferAttribute(lineIds, 1));

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

    /* ── Mouse parallax ──────────────────────────────────────── */
    const targetMouse = new THREE.Vector2();
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseInteractionRef.current) return;
      targetMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      targetMouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    /* ── Pause when offscreen ───────────────────────────────── */
    const io = new IntersectionObserver(
      ([entry]) => { pausedRef.current = !entry.isIntersecting; },
      { threshold: 0 },
    );
    io.observe(canvas);

    /* ── Reduced motion ─────────────────────────────────────── */
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionMq.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    motionMq.addEventListener('change', onMotionChange);

    /* ── rAF loop ───────────────────────────────────────────── */
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

      lines.rotation.y = t * 0.18 * effSpeed;
      lines.rotation.x = Math.sin(t * 0.09) * 0.18;

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
  }, [size, baseNodes, colors.primary, colors.secondary, colors.accent]);

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
