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
/* Tempo que cada item fica visível antes de iniciar o fade-out. */
const LIFETIME_MS = 1600;
/* Cap de itens simultâneos — mais que isso vira poluição
 *  visual + custo de compositing. */
const MAX_ITEMS = 6;

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

  const spawnAt = (x: number, y: number) => {
    const last = lastSpawnRef.current;
    if (last) {
      const dx = x - last.x;
      const dy = y - last.y;
      if (Math.hypot(dx, dy) < MIN_DIST) return;
    }
    lastSpawnRef.current = { x, y };
    seqRef.current += 1;
    const id = seqRef.current;
    const src = EXCLUSIVE_PHOTOS[photoIdxRef.current % EXCLUSIVE_PHOTOS.length];
    photoIdxRef.current += 1;
    /* Rotação determinística por id pra evitar Math.random no
     *  client-spawn (mesmo path determinístico fica mais fácil
     *  de debugar). Range -14° a +14°. */
    const rotate = ((id * 17) % 29) - 14;
    setItems((arr) => {
      const next = [...arr, { id, x, y, src, rotate }];
      return next.length > MAX_ITEMS
        ? next.slice(next.length - MAX_ITEMS)
        : next;
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

  /* Mobile / no-mouse fallback — quando a surface está visível
   *  no viewport e o usuário scrolla, spawnamos em posições
   *  semi-aleatórias dentro do retângulo. */
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
    return () => window.removeEventListener('scroll', onScroll);
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
      <div className={styles.copy}>
        <span className={styles.featureBadge}>Feature 02</span>
        <h3 className={styles.featureTitle}>Conteúdo exclusivo</h3>
        <p className={styles.featureDesc}>
          Bastidores, ensaios e fotos inéditas só pra quem pertence ao
          Fanverse. Passe o cursor pra revelar.
        </p>
      </div>

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
