'use client';

import { useState, useEffect } from 'react';
import { globeStore } from '@/lib/globeStore';
import styles from './ListeningTogether.module.css';

const LISTENERS = [
  { id: 'l1', name: 'Beatriz K.',  city: 'Rio de Janeiro', center: [-43.1729, -22.9068] as [number, number], zoom: 10, img: 'https://i.pravatar.cc/72?img=47' },
  { id: 'l2', name: 'Rafael S.',   city: 'Belo Horizonte', center: [-43.9378, -19.9167] as [number, number], zoom: 10, img: 'https://i.pravatar.cc/72?img=12' },
  { id: 'l3', name: 'Lucas M.',    city: 'Fortaleza',      center: [-38.5434,  -3.7172] as [number, number], zoom: 10, img: 'https://i.pravatar.cc/72?img=33' },
  { id: 'l4', name: 'Ana C.',      city: 'Curitiba',       center: [-49.2654, -25.4284] as [number, number], zoom: 10, img: 'https://i.pravatar.cc/72?img=56' },
  { id: 'l5', name: 'Thiago F.',   city: 'Salvador',       center: [-38.5108, -12.9714] as [number, number], zoom: 10, img: 'https://i.pravatar.cc/72?img=8'  },
  { id: 'l6', name: 'Paula G.',    city: 'Recife',         center: [-34.8813,  -8.0539] as [number, number], zoom: 10, img: 'https://i.pravatar.cc/72?img=44' },
  { id: 'l7', name: 'Diego V.',    city: 'Porto Alegre',   center: [-51.2177, -30.0277] as [number, number], zoom: 10, img: 'https://i.pravatar.cc/72?img=15' },
];

// Non-linear delays (ms) between each avatar appearing — 3s / 1s / 4s pattern
const STEP_MS  = [3000, 1000, 4000, 3000, 1000, 4000, 3000];
const HOLD_MS  = 4000; // how long all 7 stay visible
const EXIT_MS  = 500;  // duration of exit animation cycle

type PlayerSize = 'mini' | 'horizontal' | 'expanded' | 'video';

interface ListeningTogetherProps {
  playerExpanded?: boolean;
  playerSize?: PlayerSize;
}

export default function ListeningTogether({ playerExpanded = false, playerSize }: ListeningTogetherProps) {
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [visibleCount, setVisible]  = useState(0);
  const [exiting, setExiting]       = useState(false);
  const count = 455;

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;

    if (exiting) {
      // after exit animations finish, reset and restart
      t = setTimeout(() => {
        setExiting(false);
        setVisible(0);
      }, EXIT_MS);
      return () => clearTimeout(t);
    }

    if (visibleCount < LISTENERS.length) {
      // reveal next avatar after its individual delay
      t = setTimeout(() => setVisible(v => v + 1), STEP_MS[visibleCount]);
      return () => clearTimeout(t);
    }

    // all visible — hold, then trigger exit
    t = setTimeout(() => setExiting(true), HOLD_MS);
    return () => clearTimeout(t);
  }, [visibleCount, exiting]);

  // Offset baseado no tamanho do player:
  // - mini/horizontal: ~80px (apenas pílula compacta)
  // - expanded:        +112px de altura (progress + controles)
  // - video:           +180px de iframe 16:9 (320px largura → 180px altura)
  // playerSize tem prioridade sobre playerExpanded (boolean legado)
  const bottomOffset = (() => {
    if (playerSize === 'video') return 308;     // 102 base + ~206 (vídeo + audio expandido)
    if (playerSize === 'expanded') return 214;
    if (playerSize === 'mini' || playerSize === 'horizontal') return 102;
    return playerExpanded ? 214 : 102;
  })();

  return (
    <div className={styles.root} style={{ bottom: bottomOffset }}>
      <div className={styles.avatars}>
        {LISTENERS.slice(0, visibleCount).map((user, i) => (
          <div
            key={user.id}
            className={`${styles.wrap} ${exiting ? styles.wrapExiting : ''}`}
            style={{ '--i': i } as React.CSSProperties}
            onMouseEnter={() => setHoveredId(user.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => globeStore.flyTo(user.center, user.zoom)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.avatar} src={user.img} alt={user.name} />
            <div className={`${styles.tooltip} ${hoveredId === user.id ? styles.tooltipVisible : ''}`}>
              <span className={styles.tooltipName}>{user.name}</span>
              <span className={styles.tooltipCity}>{user.city}</span>
            </div>
          </div>
        ))}

        {visibleCount > 0 && !exiting && (
          <div className={styles.liveCount}>
            <span className={styles.liveCountNum}>+{count.toLocaleString('pt-BR')} pessoas</span>
            <span className={styles.liveCountLabel}> ouvindo com você</span>
          </div>
        )}
      </div>
    </div>
  );
}
