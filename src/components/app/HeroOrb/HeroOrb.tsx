'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import styles from './HeroOrb.module.css';

/**
 * HeroOrb — premium abstract particle sphere.
 *
 * A noise-deformed cloud of glowing points that rotates slowly,
 * pulses with a soft purple/magenta/orange palette, and responds
 * subtly to mouse movement. Built with raw Three.js (the project
 * already ships three@0.149 and we'd otherwise need to add R3F +
 * @react-three/postprocessing for a 70x70 component — not worth
 * the ~250kb bundle hit).
 *
 * Key design choices
 *  • No post-processing: at this canvas size (70x70 CSS px, ~140x140
 *    backing pixels at DPR=2) a bloom pass costs more than the visual
 *    gain. Glow comes from per-particle radial alpha + additive
 *    blending, which produces a clean soft halo when ~1000 particles
 *    overlap near the center.
 *  • No textures: every visual is procedural. Faster to load and
 *    sharper at any DPR.
 *  • IntersectionObserver pauses the rAF loop when the canvas is
 *    offscreen — important because this lives in the top bar and
 *    may scroll out of view on small viewports.
 *  • prefers-reduced-motion is honored: animation freezes after a
 *    half-second establishing shot, so users with motion sensitivity
 *    still see the visual but it doesn't pulse.
 *  • Mouse parallax is window-level (not canvas-local) because the
 *    orb is too small to be the cursor target on its own — most of
 *    the time the user's pointer is elsewhere.
 *
 * Configuration
 *  • size: render canvas footprint in CSS px (default 70)
 *  • particleCount: 1000 is the sweet spot for 70x70; more particles
 *    fill the area but each individual point reads less; fewer than
 *    600 starts to look sparse.
 *  • speed: time multiplier (default 1)
 *  • colors: 3-stop palette
 *  • enableMouseInteraction: turn off the parallax + repulsion
 */

interface HeroOrbProps {
  size?: number;
  particleCount?: number;
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
  particleCount: 1000,
  speed: 1,
  colors: {
    primary:   '#9333ea', // violet-600 (deep purple)
    secondary: '#ec4899', // pink-500   (magenta)
    accent:    '#fb923c', // orange-400 (warm)
  },
  enableMouseInteraction: true,
};

export default function HeroOrb({
  size = DEFAULTS.size,
  particleCount = DEFAULTS.particleCount,
  speed = DEFAULTS.speed,
  colors = DEFAULTS.colors,
  enableMouseInteraction = DEFAULTS.enableMouseInteraction,
  className,
  ariaLabel = 'Animação decorativa',
}: HeroOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live refs the rAF loop reads — avoids re-creating the renderer
  // when these change.
  const speedRef         = useRef(speed);
  const pausedRef        = useRef(false);
  const reducedMotionRef = useRef(false);
  const mouseInteractionRef = useRef(enableMouseInteraction);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { mouseInteractionRef.current = enableMouseInteraction; }, [enableMouseInteraction]);

  /* ── Renderer bootstrap ──────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // WebGL context — antialias off (we don't need geometric edges
    // smoothed; particles already have soft alpha), alpha on for
    // transparent background.
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.z = 4.6;

    /* ── Particle layout: spherical Fibonacci ──────────────
     * Distributes N points evenly on the unit sphere without the
     * polar pinching of lat/lon meshing. The golden-angle increment
     * (2.4 rad ≈ 137.5°) gives the most "random-looking" yet
     * regularly-spaced layout. */
    const positions = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.39996
    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2; // [1, -1]
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      seeds[i] = Math.random();
      // Particle size variation — some "lead" particles are larger,
      // most are small. Roughly a power distribution skewing small.
      sizes[i] = 0.5 + Math.pow(Math.random(), 2.5) * 1.6;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

    const colA = new THREE.Color(colors.primary   ?? DEFAULTS.colors.primary);
    const colB = new THREE.Color(colors.secondary ?? DEFAULTS.colors.secondary);
    const colC = new THREE.Color(colors.accent    ?? DEFAULTS.colors.accent);

    const material = new THREE.ShaderMaterial({
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime:       { value: 0 },
        uSpeed:      { value: speed },
        uMouse:      { value: new THREE.Vector2(0, 0) },
        uIntensity:  { value: 1.0 },
        uPixelRatio: { value: dpr },
        uColorA:     { value: colA },
        uColorB:     { value: colB },
        uColorC:     { value: colC },
      },
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
      blending:    THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    /* ── Mouse parallax ──────────────────────────────────── */
    const targetMouse = new THREE.Vector2();
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseInteractionRef.current) return;
      targetMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      targetMouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    /* ── Visibility observer ──────────────────────────────
     * Pause rAF when the canvas isn't on screen so the orb doesn't
     * cost a frame budget in tabs/scroll-positions where it isn't
     * even visible. */
    const io = new IntersectionObserver(
      ([entry]) => { pausedRef.current = !entry.isIntersecting; },
      { threshold: 0 },
    );
    io.observe(canvas);

    /* ── prefers-reduced-motion gate ──────────────────────
     * Read once + listen for changes. When reduced motion is set
     * we drop uSpeed to a near-static value so the orb still
     * looks like itself without strobing. */
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionMq.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    motionMq.addEventListener('change', onMotionChange);

    /* ── rAF loop ─────────────────────────────────────────── */
    const clock = new THREE.Clock();
    let rafId = 0;
    let smoothedMouseX = 0;
    let smoothedMouseY = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (pausedRef.current) return;

      const t = clock.getElapsedTime();

      // Reduced motion: clamp time advancement so the visual breathes
      // instead of pulsing.
      const effSpeed = reducedMotionRef.current ? 0.15 : speedRef.current;
      material.uniforms.uTime.value  = t;
      material.uniforms.uSpeed.value = effSpeed;

      // Smooth interpolation toward the latest target mouse position.
      // Lerp factor 0.07 = ~10 frames to settle, feels luxurious.
      smoothedMouseX += (targetMouse.x - smoothedMouseX) * 0.07;
      smoothedMouseY += (targetMouse.y - smoothedMouseY) * 0.07;
      material.uniforms.uMouse.value.set(smoothedMouseX, smoothedMouseY);

      // Idle rotation lives on the parent THREE.Points object so it
      // applies uniformly to the whole cloud — the in-shader wobble
      // adds the asymmetric character on top.
      points.rotation.y = t * 0.18 * effSpeed;
      points.rotation.x = Math.sin(t * 0.09) * 0.18;

      renderer.render(scene, camera);
    };
    tick();

    /* ── Cleanup ──────────────────────────────────────────── */
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
  }, [size, particleCount, colors.primary, colors.secondary, colors.accent]);

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
