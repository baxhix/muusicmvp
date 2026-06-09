'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import styles from './CursorTrailGallery.module.css';

/**
 * CursorTrailGallery — Feature 02 da Section 3.
 *
 * Efeito "cursor trail": conforme o usuário move o mouse (ou
 * scrolla, no mobile) sobre a surface da feature, miniaturas
 * de fotos exclusivas da Ana Castela vão aparecendo na posição
 * do cursor e somem em ~1.6s. As fotos cyclam pela lista de 8
 * assets em /public/feed.
 *
 * Mecânica:
 *  - Spawn por proximidade — só dispara um novo item quando a
 *    distância desde o último spawn ultrapassa MIN_DIST (evita
 *    centenas de fotos sobrepostas com micromovimentos).
 *  - Cap em MAX_ITEMS — quando excede, descarta o mais antigo.
 *  - Lifetime: cada item entra com fade+scale e auto-remove
 *    via setTimeout depois de LIFETIME_MS, com AnimatePresence
 *    rodando exit anim.
 *  - Mobile fallback: listener global de scroll spawna no centro
 *    da surface quando ela está visível no viewport — assim a
 *    feature ainda "respira" sem mouse hover.
 *
 * O `transformTemplate` prepend `translate(-50%, -50%)` garante
 * que a foto seja centralizada na posição (x, y) mesmo com o
 * motion compondo scale/rotate em cima.
 */

const EXCLUSIVE_PHOTOS = [
  '/feed/ana-castela-1.png',
  '/feed/ana-castela-fespop-1.png',
  '/feed/ana-castela-2.png',
  '/feed/ana-castela-fespop-2.png',
  '/feed/ana-castela-3.png',
  '/feed/ana-castela-fespop-3.png',
  '/feed/ana-castela-4.png',
  '/feed/ana-castela-fespop-4.png',
];

interface TrailItem {
  id: number;
  x: number; // px relative to surface
  y: number;
  src: string;
  rotate: number;
}

/* Distância mínima entre spawns (px). Microtremores e
 *  rebatimentos não criam pile-up. */
const MIN_DIST = 90;
/* Mesma threshold, porém mais larga no mobile pra reduzir
 *  spawn rate durante scroll inercial (que pode disparar
 *  scrollY changes a cada frame). */
const MIN_DIST_MOBILE = 140;
/* Tempo que cada item fica visível antes de iniciar o fade-out. */
const LIFETIME_MS = 1600;
/* Cap de itens simultâneos — mais que isso vira poluição
 *  visual + custo de compositing (cada item é um motion layer
 *  com box-shadow + GPU compositing). Mobile reduz pra 4 pra
 *  aliviar GPU em devices low-end. */
const MAX_ITEMS = 6;
const MAX_ITEMS_MOBILE = 4;
/* Verificação leve de mobile via media query — evita custo de
 *  pegar useIsMobile/AppShellContext (componente roda na landing
 *  /teste, fora do app shell). */
function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 900px)').matches;
}
/* prefers-reduced-motion: desliga o trail completamente. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function CursorTrailGallery() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<TrailItem[]>([]);
  /* Posição do último spawn (pra cálculo de distância). */
  const lastSpawnRef = useRef<{ x: number; y: number } | null>(null);
  /* Índice cíclico no array EXCLUSIVE_PHOTOS. */
  const photoIdxRef = useRef(0);
  /* Counter monotônico pra gerar IDs únicos (Math.random na
   *  render seria fonte de bug em SSR). */
  const seqRef = useRef(0);
  /* Refs pros timeouts pendentes — limpamos no unmount pra
   *  evitar setState após o componente sumir. */
  const timeoutsRef = useRef<Set<number>>(new Set());

  /* Cache do viewport check + reduced-motion no mount — evita
   *  matchMedia call a cada spawn. */
  const isMobileRef = useRef(false);
  const reducedMotionRef = useRef(false);
  useEffect(() => {
    isMobileRef.current = isMobileViewport();
    reducedMotionRef.current = prefersReducedMotion();
  }, []);

  const spawnAt = (x: number, y: number) => {
    /* Reduced motion → não spawna nada (acessibilidade). */
    if (reducedMotionRef.current) return;
    const isMobile = isMobileRef.current;
    const minDist = isMobile ? MIN_DIST_MOBILE : MIN_DIST;
    const cap = isMobile ? MAX_ITEMS_MOBILE : MAX_ITEMS;

    const last = lastSpawnRef.current;
    if (last) {
      const dx = x - last.x;
      const dy = y - last.y;
      if (Math.hypot(dx, dy) < minDist) return;
    }
    lastSpawnRef.current = { x, y };
    seqRef.current += 1;
    const id = seqRef.current;
    const src = EXCLUSIVE_PHOTOS[photoIdxRef.current % EXCLUSIVE_PHOTOS.length];
    photoIdxRef.current += 1;
    /* Rotação determinística por id pra evitar Math.random.
     *  Range -14° a +14°. */
    const rotate = ((id * 17) % 29) - 14;
    setItems((arr) => {
      const next = [...arr, { id, x, y, src, rotate }];
      return next.length > cap ? next.slice(next.length - cap) : next;
    });
    const t = window.setTimeout(() => {
      setItems((arr) => arr.filter((i) => i.id !== id));
      timeoutsRef.current.delete(t);
    }, LIFETIME_MS);
    timeoutsRef.current.add(t);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    spawnAt(e.clientX - rect.left, e.clientY - rect.top);
  };

  /* Mobile / no-mouse fallback — duas fontes complementares:
   *
   *   1. Scroll-driven (era a única antes) — spawna quando o
   *      usuário scrolla com a surface no viewport.
   *   2. Per spec atualizado "no mobile, elas surgem
   *      gradativamente de forma aleatória" — interval a cada
   *      ~1.8s spawna em posição aleatória dentro do retângulo
   *      enquanto a surface está visível, mesmo sem scroll. */
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    let spawnCount = 0;
    const onScroll = () => {
      const dy = Math.abs(window.scrollY - lastScrollY);
      if (dy < 60) return;
      lastScrollY = window.scrollY;
      const rect = el.getBoundingClientRect();
      /* Surface fora do viewport — nada a fazer. */
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      /* Posição determinística baseada em counter pra
       *  espalhar pelos cantos sem Math.random. */
      spawnCount += 1;
      const u = (spawnCount * 0.382) % 1; // golden ratio mod
      const v = (spawnCount * 0.618) % 1;
      const x = rect.width * (0.15 + u * 0.7);
      const y = rect.height * (0.15 + v * 0.7);
      spawnAt(x, y);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    /* Auto-spawn em mobile — sem depender de scroll, fotos
     *  aparecem em posições aleatórias enquanto a surface está
     *  visível. Desktop continua sem essa fonte (mouse hover já
     *  cobre o caso). Reduced-motion bloqueia tudo via spawnAt. */
    let intervalId: number | null = null;
    if (isMobileRef.current) {
      let tickCount = 0;
      intervalId = window.setInterval(() => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        tickCount += 1;
        /* Pseudo-random via golden ratio multipliers diferentes
         *  do scroll fallback acima — evita pile-up quando os
         *  dois disparam no mesmo frame. */
        const u = (tickCount * 0.754 + 0.13) % 1;
        const v = (tickCount * 0.291 + 0.47) % 1;
        const x = rect.width * (0.08 + u * 0.84);
        const y = rect.height * (0.1 + v * 0.8);
        spawnAt(x, y);
      }, 1800);
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, []);

  /* Cleanup dos timeouts pendentes ao unmount. */
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((t) => window.clearTimeout(t));
      timeouts.clear();
    };
  }, []);

  return (
    <div className={styles.root}>
      {/* Headline centralizado. Desktop: uma linha. Mobile: duas
       *  linhas forçadas via <br> que só aparece no mobile (per
       *  spec "no mobile, deixe o headline em duas linhas"). Com
       *  display:none no desktop, o whitespace ao redor colapsa
       *  e o título volta a ler "Conteúdo exclusivo" numa linha. */}
      <h3 className={styles.featureTitle}>
        Conteúdo<br className={styles.titleBreak} /> exclusivo
      </h3>

      {/* Diferenciais — bullets com os destaques do conteúdo
       *  exclusivo. Row centralizada que wrappa no mobile; cada
       *  item tem um dot com o gradient da marca. */}
      <ul className={styles.perks}>
        <li>Lives</li>
        <li>Backstage</li>
        <li>Grupos fechados</li>
        <li>Pré-lançamentos</li>
      </ul>

      {/* Surface full-width abaixo do headline. Sem box (sem bg
       *  gradient, sem border): a trail é desenhada direto sobre
       *  a galáxia da landing. */}
      <div
        ref={surfaceRef}
        className={styles.surface}
        onMouseMove={onMouseMove}
        aria-hidden="true"
      >
        {/* Hint sutil no centro pra desktop saber que precisa
         *  hoverar (some no primeiro spawn). */}
        {items.length === 0 && (
          <div className={styles.hint}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3l7 19 2-8 8-2L3 3z" />
            </svg>
            <span>Mexa o cursor pra revelar</span>
          </div>
        )}

        <AnimatePresence>
          {items.map((it) => (
            <motion.div
              key={it.id}
              className={styles.photo}
              style={{ left: it.x, top: it.y }}
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              /* Compõe o centering -50%/-50% + a rotação fixa
               *  por item com a scale/opacity do motion. */
              transformTemplate={(_props, generated) =>
                `translate(-50%, -50%) rotate(${it.rotate}deg) ${generated}`
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.src} alt="" draggable={false} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
