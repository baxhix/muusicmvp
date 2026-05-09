'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ── Constants ──────────────────────────────────────────────────────── */

const RADIUS = 100;
const INK = 0xF5F5F7;
const ACCENT = 0x7DD3FC;       // ciano — usado nos arcos e no pulse dot do Rio
const ATMO_INNER = 0x6A6A75;   // halo interno: cinza neutro com leve frieza
const ATMO_OUTER = 0x3F3F47;   // halo externo: cinza ainda mais escuro

const FAN_HUBS: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { name: 'Rio',       lat: -22.9068, lng: -43.1729 },
  { name: 'NYC',       lat: 40.7128,  lng: -74.0060 },
  { name: 'LA',        lat: 34.0522,  lng: -118.2437 },
  { name: 'México',    lat: 19.4326,  lng: -99.1332 },
  { name: 'BA',        lat: -34.6037, lng: -58.3816 },
  { name: 'Toronto',   lat: 43.6532,  lng: -79.3832 },
  { name: 'London',    lat: 51.5074,  lng: -0.1278 },
  { name: 'Paris',     lat: 48.8566,  lng: 2.3522 },
  { name: 'Berlin',    lat: 52.5200,  lng: 13.4050 },
  { name: 'Madrid',    lat: 40.4168,  lng: -3.7038 },
  { name: 'Roma',      lat: 41.9028,  lng: 12.4964 },
  { name: 'Moscow',    lat: 55.7558,  lng: 37.6173 },
  { name: 'Istanbul',  lat: 41.0082,  lng: 28.9784 },
  { name: 'Cairo',     lat: 30.0444,  lng: 31.2357 },
  { name: 'Lagos',     lat: 6.5244,   lng: 3.3792 },
  { name: 'Joburg',    lat: -26.2041, lng: 28.0473 },
  { name: 'Mumbai',    lat: 19.0760,  lng: 72.8777 },
  { name: 'Bangalore', lat: 12.9716,  lng: 77.5946 },
  { name: 'Singapore', lat: 1.3521,   lng: 103.8198 },
  { name: 'Bangkok',   lat: 13.7563,  lng: 100.5018 },
  { name: 'Jakarta',   lat: -6.2088,  lng: 106.8456 },
  { name: 'HK',        lat: 22.3193,  lng: 114.1694 },
  { name: 'Taipei',    lat: 25.0330,  lng: 121.5654 },
  { name: 'Seoul',     lat: 37.5665,  lng: 126.9780 },
  { name: 'Tokyo',     lat: 35.6762,  lng: 139.6503 },
  { name: 'Sydney',    lat: -33.8688, lng: 151.2093 },
  { name: 'Auckland',  lat: -36.8485, lng: 174.7633 },
  { name: 'Dubai',     lat: 25.2048,  lng: 55.2708 },
  { name: 'Lisboa',    lat: 38.7223,  lng: -9.1393 },
];

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function HeroGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* ── Scene + camera + renderer ── */
    const scene = new THREE.Scene();
    let w = Math.max(container.clientWidth, 320);
    let h = Math.max(container.clientHeight, 320);

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
    camera.position.set(40, 40, 280);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    /* ── Globe group ── */
    const globe = new THREE.Group();
    scene.add(globe);

    // Sólido escuro
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 64, 32),
      new THREE.MeshBasicMaterial({ color: 0x101018 }),
    );
    globe.add(earth);

    // Wireframe sutil
    globe.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS * 1.0015, 32, 16),
        new THREE.MeshBasicMaterial({
          color: INK,
          wireframe: true,
          transparent: true,
          opacity: 0.07,
        }),
      ),
    );

    // Pontos no padrão Fibonacci (1800 dots) — "land"
    const landGroup = new THREE.Group();
    globe.add(landGroup);
    const dotMat = new THREE.PointsMaterial({
      color: 0x3a3a48,
      size: 0.7,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
    });
    const landPositions: number[] = [];
    for (let i = 0; i < 1800; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 1800);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
      const x = RADIUS * 1.005 * Math.sin(phi) * Math.cos(theta);
      const y = RADIUS * 1.005 * Math.cos(phi);
      const z = RADIUS * 1.005 * Math.sin(phi) * Math.sin(theta);
      landPositions.push(x, y, z);
    }
    const landGeo = new THREE.BufferGeometry();
    landGeo.setAttribute('position', new THREE.Float32BufferAttribute(landPositions, 3));
    landGroup.add(new THREE.Points(landGeo, dotMat));

    // Anel equatorial
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS * 1.001, 0.15, 6, 128),
      new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.45 }),
    );
    ring.rotation.x = Math.PI / 2;
    globe.add(ring);

    // Atmosfera (halo cinza-escuro neutro, sem mais o azul/lilás)
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS * 1.05, 64, 32),
        new THREE.MeshBasicMaterial({
          color: ATMO_INNER,
          transparent: true,
          opacity: 0.10,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS * 1.10, 64, 32),
        new THREE.MeshBasicMaterial({
          color: ATMO_OUTER,
          transparent: true,
          opacity: 0.06,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );

    /* ── Fan hubs ── */
    const hubsGroup = new THREE.Group();
    globe.add(hubsGroup);
    FAN_HUBS.forEach((hub) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 12, 12),
        new THREE.MeshBasicMaterial({ color: INK }),
      );
      mesh.position.copy(latLngToVec3(hub.lat, hub.lng, RADIUS * 1.005));
      hubsGroup.add(mesh);

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 12, 12),
        new THREE.MeshBasicMaterial({
          color: INK,
          transparent: true,
          opacity: 0.18,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      halo.position.copy(mesh.position);
      hubsGroup.add(halo);
    });

    // Pulse accent dot (Rio)
    const accentDot = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 16, 16),
      new THREE.MeshBasicMaterial({ color: ACCENT }),
    );
    accentDot.position.copy(latLngToVec3(-22.9068, -43.1729, RADIUS * 1.005));
    hubsGroup.add(accentDot);

    /* ── Arcs ── */
    const arcsGroup = new THREE.Group();
    globe.add(arcsGroup);

    type Arc = {
      line: THREE.Line;
      points: THREE.Vector3[];
      segments: number;
      elapsed: number;
      duration: number;
      growPhase: number;
      stayPhase: number;
      isAccent: boolean;
      done: boolean;
      _geometry: THREE.BufferGeometry;
      _material: THREE.LineBasicMaterial;
    };

    const activeArcs: Arc[] = [];

    function makeArc(a: typeof FAN_HUBS[number], b: typeof FAN_HUBS[number], isAccent: boolean): Arc {
      const startVec = latLngToVec3(a.lat, a.lng, RADIUS);
      const endVec = latLngToVec3(b.lat, b.lng, RADIUS);
      const dist = startVec.distanceTo(endVec);
      const altitude = RADIUS * 0.15 + dist * 0.45;
      const mid = startVec.clone().add(endVec).normalize().multiplyScalar(RADIUS + altitude);
      const curve = new THREE.QuadraticBezierCurve3(startVec, mid, endVec);
      const SEGMENTS = 60;
      const points = curve.getPoints(SEGMENTS);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3),
      );
      const material = new THREE.LineBasicMaterial({
        color: isAccent ? ACCENT : INK,
        transparent: true,
        opacity: isAccent ? 0.85 : 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);

      return {
        line,
        points,
        segments: SEGMENTS,
        elapsed: 0,
        duration: 1.6 + Math.random() * 1.4,
        growPhase: 0.45,
        stayPhase: 0.20,
        isAccent,
        done: false,
        _geometry: geometry,
        _material: material,
      };
    }

    function spawnArc() {
      const a = FAN_HUBS[Math.floor(Math.random() * FAN_HUBS.length)];
      let b = FAN_HUBS[Math.floor(Math.random() * FAN_HUBS.length)];
      let safety = 0;
      while (b.name === a.name && safety++ < 5) {
        b = FAN_HUBS[Math.floor(Math.random() * FAN_HUBS.length)];
      }
      const isAccent = Math.random() > 0.55;
      const arc = makeArc(a, b, isAccent);
      arcsGroup.add(arc.line);
      activeArcs.push(arc);
    }

    function updateArc(arc: Arc, dt: number) {
      arc.elapsed += dt;
      const t = arc.elapsed / arc.duration;
      if (t >= 1) { arc.done = true; return; }

      let drawnFraction: number;
      let opacity: number;
      const baseOp = arc.isAccent ? 0.85 : 0.55;

      if (t < arc.growPhase) {
        drawnFraction = t / arc.growPhase;
        opacity = baseOp * Math.min(1, drawnFraction * 2);
      } else if (t < arc.growPhase + arc.stayPhase) {
        drawnFraction = 1;
        opacity = baseOp;
      } else {
        drawnFraction = 1;
        const fadeT = (t - arc.growPhase - arc.stayPhase) / (1 - arc.growPhase - arc.stayPhase);
        opacity = baseOp * (1 - fadeT);
      }

      const posAttr = arc._geometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const cutoff = Math.floor(arc.segments * drawnFraction);
      for (let i = 0; i <= arc.segments; i++) {
        const sourceIdx = Math.min(i, cutoff);
        const p = arc.points[sourceIdx];
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      }
      posAttr.needsUpdate = true;
      arc._material.opacity = opacity;
    }

    // Initial wave
    for (let i = 0; i < 14; i++) {
      spawnArc();
      const last = activeArcs[activeArcs.length - 1];
      last.elapsed = Math.random() * last.duration;
    }

    /* ── Resize ── */
    function resize() {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        w = rect.width;
        h = rect.height;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    }
    window.addEventListener('resize', resize);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }
    resize();

    /* ── Mouse drag rotation ── */
    let isDragging = false;
    let lastX = 0;
    let userRotX = 0;
    let userMomentumX = 0;
    let userMomentumY = 0;
    container.style.cursor = 'grab';

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastX = e.clientX;
      container.style.cursor = 'grabbing';
    };
    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = 'grab';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      userMomentumX = dx * 0.005;
      lastX = e.clientX;
    };
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    /* ── Animation loop ── */
    let lastTime = performance.now();
    let spawnTimer = 0;
    let pulseT = 0;
    let rafId = 0;

    function animate() {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      pulseT += dt;

      // Auto-rotate
      globe.rotation.y += 0.0015;

      // Apply user drag momentum
      if (!isDragging) {
        userMomentumX *= 0.93;
        userMomentumY *= 0.93;
      }
      globe.rotation.y += userMomentumX;
      globe.rotation.x = userRotX;

      // Smooth tilt
      scene.rotation.x = Math.sin(pulseT * 0.05) * 0.02;

      // Update arcs
      for (let i = activeArcs.length - 1; i >= 0; i--) {
        updateArc(activeArcs[i], dt);
        if (activeArcs[i].done) {
          arcsGroup.remove(activeArcs[i].line);
          activeArcs[i]._geometry.dispose();
          activeArcs[i]._material.dispose();
          activeArcs.splice(i, 1);
        }
      }

      // Spawn new arcs
      spawnTimer += dt;
      if (spawnTimer > 0.25 && activeArcs.length < 22) {
        spawnArc();
        spawnTimer = 0;
      }

      // Pulse accent dot
      const pulseScale = 1 + Math.sin(pulseT * 3) * 0.18;
      accentDot.scale.set(pulseScale, pulseScale, pulseScale);

      renderer.render(scene, camera);
    }
    animate();

    /* ── Cleanup ── */
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mousedown', onMouseDown);
      if (resizeObserver) resizeObserver.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      // Limpa geometrias e materiais alocados
      activeArcs.forEach((arc) => {
        arc._geometry.dispose();
        arc._material.dispose();
      });
      landGeo.dispose();
      dotMat.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
      aria-hidden="true"
    />
  );
}
