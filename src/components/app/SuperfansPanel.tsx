'use client';

import { useEffect, useState, type AnimationEvent } from 'react';
import styles from './SuperfansPanel.module.css';

interface SuperfansPanelProps {
  open: boolean;
  onClose: () => void;
}

type Superfan = {
  rank: number;
  name: string;
  fanpoints: number;
  level: number;
  img: string;
  city: string;
  trend?: 'up' | 'down' | 'same';
};

const TOP_6: Superfan[] = [
  { rank: 1, name: 'Isabela M.',     fanpoints: 12847, level: 12, img: 'https://i.pravatar.cc/96?img=44', city: 'São Paulo',      trend: 'up' },
  { rank: 2, name: 'Mariana Lopes',  fanpoints: 11203, level: 11, img: 'https://i.pravatar.cc/96?img=47', city: 'Rio de Janeiro', trend: 'up' },
  { rank: 3, name: 'João Pedro',     fanpoints: 10956, level: 11, img: 'https://i.pravatar.cc/96?img=8',  city: 'Belo Horizonte', trend: 'same' },
  { rank: 4, name: 'Pedro H.',       fanpoints: 9420,  level: 10, img: 'https://i.pravatar.cc/96?img=12', city: 'Curitiba',       trend: 'up' },
  { rank: 5, name: 'Camila F.',      fanpoints: 8721,  level: 9,  img: 'https://i.pravatar.cc/96?img=53', city: 'Fortaleza',      trend: 'down' },
  { rank: 6, name: 'Diógenis Silva', fanpoints: 5210,  level: 8,  img: 'https://i.pravatar.cc/96?img=15', city: 'São Paulo',      trend: 'up' },
];

// ── Gera fãs ranks 7–100 deterministicamente ────────────────────────────────
const NAMES_POOL = [
  'Lucas Andrade', 'Beatriz Costa', 'Gabriel Souza', 'Larissa Mendes', 'Felipe Rocha',
  'Juliana Reis', 'Rafael Lima', 'Camila Duarte', 'Thiago Silva', 'Aline Ferreira',
  'Bruno Carvalho', 'Carolina Pires', 'Eduardo Vieira', 'Fernanda Alves', 'Gustavo Nunes',
  'Helena Martins', 'Igor Ramos', 'Jéssica Brito', 'Kauã Teixeira', 'Letícia Pinto',
  'Marcelo Ortiz', 'Natália Cunha', 'Otávio Moura', 'Paula Cardoso', 'Rodrigo Barros',
  'Sabrina Tavares', 'Tomás Faria', 'Úrsula Maia', 'Vinícius Castro', 'Yasmin Lopes',
  'Adrian Cole', 'Mia Walker', 'Liam Hayes', 'Nora Bennett', 'Ezra Park',
  'Zara Khan', 'Hiroshi Tanaka', 'Yuki Sato', 'Wei Zhang', 'Mei Chen',
  'Anastasia Volkova', 'Dmitri Sokolov', 'Adaeze Okafor', 'Kwame Mwangi',
];
const CITIES_POOL = [
  'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Fortaleza',
  'Porto Alegre', 'Brasília', 'Salvador', 'Recife', 'Manaus',
  'Lisboa', 'Madrid', 'Paris', 'London', 'Berlin',
  'New York', 'Los Angeles', 'Chicago', 'Miami',
  'Tokyo', 'Beijing', 'Shanghai', 'Moscou', 'Lagos', 'Cairo',
];
const TRENDS: Array<'up' | 'down' | 'same'> = ['up', 'down', 'same'];

function generateExtraFans(): Superfan[] {
  const out: Superfan[] = [];
  let seed = 0xFA17E0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };
  // Pontuação decresce do rank 7 (~5000) até rank 100 (~120)
  for (let rank = 7; rank <= 100; rank++) {
    const t = (rank - 7) / 93; // 0 → 1
    const fanpoints = Math.round(5000 - t * 4880 + (rand() - 0.5) * 200);
    const level = Math.max(1, Math.round(8 - t * 7 + (rand() - 0.5)));
    const name = NAMES_POOL[Math.floor(rand() * NAMES_POOL.length)];
    const city = CITIES_POOL[Math.floor(rand() * CITIES_POOL.length)];
    const trend = TRENDS[Math.floor(rand() * TRENDS.length)];
    const imgId = 1 + Math.floor(rand() * 70);
    out.push({
      rank,
      name,
      fanpoints: Math.max(80, fanpoints),
      level,
      img: `https://i.pravatar.cc/96?img=${imgId}`,
      city,
      trend,
    });
  }
  return out;
}

const EXTRA_FANS = generateExtraFans();
const ALL_FANS: Superfan[] = [...TOP_6, ...EXTRA_FANS];

const ME: Superfan & { nextLevelAt: number } = {
  rank: 7,
  name: 'Ana Beatriz',
  fanpoints: 3480,
  level: 7,
  img: '/ana-beatriz-avatar.png',
  city: 'São Paulo',
  trend: 'up',
  nextLevelAt: 5000,
};

const formatPoints = (n: number) => n.toLocaleString('pt-BR');

export default function SuperfansPanel({ open, onClose }: SuperfansPanelProps) {
  // Phase: 'idle' = unmounted; 'in' = rise; 'open' = idle visible; 'out' = fall.
  const [phase, setPhase] = useState<'idle' | 'in' | 'open' | 'out'>(
    open ? 'in' : 'idle'
  );
  const [showAll, setShowAll] = useState(false);

  // Drive phase from `open` prop.
  useEffect(() => {
    if (open) {
      setPhase((p) => (p === 'idle' || p === 'out' ? 'in' : p));
    } else {
      setPhase((p) => (p === 'idle' ? 'idle' : 'out'));
    }
  }, [open]);

  // When entry/exit animations finish, settle into next phase.
  const handleAnimationEnd = (e: AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (phase === 'in' && e.animationName.includes('superfans-rise')) {
      setPhase('open');
    }
    if (phase === 'out' && e.animationName.includes('superfans-fall')) {
      setPhase('idle');
    }
  };

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (phase === 'idle') return null;

  const isIn = phase === 'in';
  const isOut = phase === 'out';

  const meProgressPct = Math.min(100, Math.round((ME.fanpoints / ME.nextLevelAt) * 100));

  return (
    <aside
      className={`${styles.panel} ${isIn ? styles.panelEntering : ''} ${isOut ? styles.panelClosing : ''}`}
      onAnimationEnd={handleAnimationEnd}
      role="dialog"
      aria-modal="false"
      aria-label="Ranking de superfãs"
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Superfãs</h2>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fechar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Minha posição */}
      <section className={styles.meCard} aria-label="Minha posição">
        <div className={styles.meRow}>
          <span className={styles.meRank}>#{ME.rank}</span>
          <div className={styles.meAvatarWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ME.img} alt={ME.name} className={styles.meAvatar} />
            <span className={styles.meBadge}>Você</span>
          </div>
          <div className={styles.meInfo}>
            <span className={styles.meName}>{ME.name}</span>
            <span className={styles.meCity}>{ME.city}</span>
          </div>
          <div className={styles.mePoints}>
            <span className={styles.mePointsNum}>{formatPoints(ME.fanpoints)}</span>
            <span className={styles.mePointsLabel}>Fanpoints</span>
          </div>
        </div>

        <div className={styles.meProgress}>
          <div className={styles.meProgressBar}>
            <div
              className={styles.meProgressFill}
              style={{ width: `${meProgressPct}%` }}
            />
          </div>
          <div className={styles.meProgressLabel}>
            <span>Nível {ME.level}</span>
            <span>
              {formatPoints(ME.nextLevelAt - ME.fanpoints)} para nível {ME.level + 1}
            </span>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* Top fans */}
      <div className={styles.listHeader}>
        <span className={styles.listEyebrow}>Ranking global</span>
        <span className={styles.listMeta}>Atualizado agora</span>
      </div>

      <div className={styles.list}>
        {(showAll ? ALL_FANS : TOP_6).map((fan) => (
          <button key={fan.rank} type="button" className={styles.fanRow}>
            <span className={`${styles.rank} ${fan.rank <= 3 ? styles.rankTop : ''}`}>
              {fan.rank === 1 ? '🥇' : fan.rank === 2 ? '🥈' : fan.rank === 3 ? '🥉' : `#${fan.rank}`}
            </span>
            <div className={styles.fanAvatarWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fan.img} alt={fan.name} className={styles.fanAvatar} />
              {fan.rank === 1 && <span className={styles.crownTop} aria-hidden="true">👑</span>}
            </div>
            <div className={styles.fanInfo}>
              <span className={styles.fanName}>{fan.name}</span>
              <span className={styles.fanCity}>{fan.city} · Nv. {fan.level}</span>
            </div>
            <div className={styles.fanPoints}>
              <span className={styles.fanPointsNum}>{formatPoints(fan.fanpoints)}</span>
              {fan.trend === 'up' && <span className={`${styles.trend} ${styles.trendUp}`}>▲</span>}
              {fan.trend === 'down' && <span className={`${styles.trend} ${styles.trendDown}`}>▼</span>}
              {fan.trend === 'same' && <span className={`${styles.trend} ${styles.trendSame}`}>—</span>}
            </div>
          </button>
        ))}

        {!showAll && (
          <button
            type="button"
            className={styles.seeMoreBtn}
            onClick={() => setShowAll(true)}
          >
            <span>Ver mais</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      <footer className={styles.footer}>
        <button type="button" className={styles.ctaPrimary}>
          Ver missões diárias
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </footer>
    </aside>
  );
}
