'use client';

import { useEffect, useMemo, useState, type AnimationEvent } from 'react';
import { useRanking } from '@/hooks/useRanking';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ApiRankingRow } from '@/lib/api/types';
import styles from './SuperfansPanel.module.css';

interface SuperfansPanelProps {
  open: boolean;
  onClose: () => void;
}

type Trend = 'up' | 'down' | 'same';

interface Superfan {
  rank: number;
  userId: string;
  name: string;
  fanpoints: number;
  level: number;
  img: string;
  city: string;
  trend: Trend;
}

// ── Mocks for fields the backend doesn't track yet ─────────────────────────
//
// Level / next-level threshold and trend are derived from data we DO have
// (points + a deterministic hash of the user id) so the UI lights up
// realistically without inventing fake users. Replace these helpers when
// the backend grows a "fan_level" or "weekly_delta" surface.

function levelFor(points: number): number {
  // Smooth curve: level 1 at 0 pts, level 2 at 100, level 3 at 400, level 4 at 900…
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, points) / 100)) + 1);
}

function nextLevelAtFor(level: number): number {
  return level * level * 100;
}

function trendFor(userId: string): Trend {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) & 0xffff;
  }
  const trends: Trend[] = ['up', 'same', 'up', 'down', 'up', 'same']; // bias toward 'up'
  return trends[h % trends.length];
}

function displayName(r: ApiRankingRow): string {
  return r.name?.trim() || r.email.split('@')[0];
}

function avatarSrc(r: ApiRankingRow): string {
  return r.avatarUrl ?? `https://i.pravatar.cc/96?u=${r.userId}`;
}

function rowToSuperfan(r: ApiRankingRow, rank: number): Superfan {
  return {
    rank,
    userId: r.userId,
    name: displayName(r),
    fanpoints: r.points,
    level: levelFor(r.points),
    img: avatarSrc(r),
    city: r.city ?? '—',
    trend: trendFor(r.userId),
  };
}

const formatPoints = (n: number) => n.toLocaleString('pt-BR');

export default function SuperfansPanel({ open, onClose }: SuperfansPanelProps) {
  const { user: authUser } = useAuth();
  const { ranking, loading, error } = useRanking(open);

  // Phase: 'idle' = unmounted; 'in' = rise; 'open' = idle visible; 'out' = fall.
  const [phase, setPhase] = useState<'idle' | 'in' | 'open' | 'out'>(open ? 'in' : 'idle');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (open) {
      setPhase((p) => (p === 'idle' || p === 'out' ? 'in' : p));
    } else {
      setPhase((p) => (p === 'idle' ? 'idle' : 'out'));
    }
  }, [open]);

  const handleAnimationEnd = (e: AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (phase === 'in' && e.animationName.includes('superfans-rise')) setPhase('open');
    if (phase === 'out' && e.animationName.includes('superfans-fall')) setPhase('idle');
  };

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ── Derive Superfan rows from the live ranking ─────────────────────────
  const fans: Superfan[] = useMemo(
    () => ranking.map((r, i) => rowToSuperfan(r, i + 1)),
    [ranking],
  );

  const top6 = fans.slice(0, 6);

  const me: Superfan & { nextLevelAt: number } | null = useMemo(() => {
    if (!authUser) return null;
    const found = fans.find((f) => f.userId === authUser.id);
    if (found) {
      return { ...found, nextLevelAt: nextLevelAtFor(found.level + 1 - 1) || nextLevelAtFor(found.level) };
    }
    // Fallback: user exists but hasn't appeared in ranking yet (just signed up).
    return {
      rank: fans.length + 1,
      userId: authUser.id,
      name: displayName({
        userId: authUser.id,
        name: authUser.name,
        email: authUser.email,
        avatarUrl: authUser.avatarUrl,
        city: authUser.city,
        country: authUser.country,
        streams: 0,
        logins: 0,
        chatsStarted: 0,
        points: 0,
      }),
      fanpoints: 0,
      level: 1,
      img: authUser.avatarUrl ?? `https://i.pravatar.cc/96?u=${authUser.id}`,
      city: authUser.city ?? '—',
      trend: 'same',
      nextLevelAt: nextLevelAtFor(2),
    };
  }, [authUser, fans]);

  if (phase === 'idle') return null;

  const isIn = phase === 'in';
  const isOut = phase === 'out';

  // Recompute nextLevelAt from the actual current level (level^2 * 100 is the
  // boundary into NEXT level; if user is already at level L, target = L+1 boundary).
  const meNextLevelAt = me ? nextLevelAtFor(me.level + 1) : 100;
  const meProgressPct = me
    ? Math.min(100, Math.max(0, Math.round((me.fanpoints / meNextLevelAt) * 100)))
    : 0;

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
      {me && (
        <section className={styles.meCard} aria-label="Minha posição">
          <div className={styles.meRow}>
            <span className={styles.meRank}>#{me.rank}</span>
            <div className={styles.meAvatarWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={me.img} src={me.img} alt={me.name} className={styles.meAvatar} />
              <span className={styles.meBadge}>Você</span>
            </div>
            <div className={styles.meInfo}>
              <span className={styles.meName}>{me.name}</span>
              <span className={styles.meCity}>{me.city}</span>
            </div>
            <div className={styles.mePoints}>
              <span className={styles.mePointsNum}>{formatPoints(me.fanpoints)}</span>
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
              <span>Nível {me.level}</span>
              <span>
                {formatPoints(Math.max(0, meNextLevelAt - me.fanpoints))} para nível {me.level + 1}
              </span>
            </div>
          </div>
        </section>
      )}

      <div className={styles.divider} />

      <div className={styles.listHeader}>
        <span className={styles.listEyebrow}>Ranking global</span>
        <span className={styles.listMeta}>
          {loading ? 'Atualizando…' : 'Atualizado agora'}
        </span>
      </div>

      <div className={styles.list}>
        {error ? (
          <div className={styles.emptyState}>
            Não consegui carregar o ranking agora ({error}).
          </div>
        ) : fans.length === 0 ? (
          <div className={styles.emptyState}>
            {loading ? 'Carregando ranking…' : 'Sem fãs ainda. Toca uma música pra começar a pontuar.'}
          </div>
        ) : (
          (showAll ? fans : top6).map((fan) => {
            const isMe = fan.userId === authUser?.id;
            return (
              <button
                key={fan.userId}
                type="button"
                className={`${styles.fanRow} ${isMe ? styles.fanRowMe : ''}`}
              >
                <span className={`${styles.rank} ${fan.rank <= 3 ? styles.rankTop : ''}`}>
                  {fan.rank === 1 ? '🥇' : fan.rank === 2 ? '🥈' : fan.rank === 3 ? '🥉' : `#${fan.rank}`}
                </span>
                <div className={styles.fanAvatarWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img key={fan.img} src={fan.img} alt={fan.name} className={styles.fanAvatar} />
                  {fan.rank === 1 && <span className={styles.crownTop} aria-hidden="true">👑</span>}
                </div>
                <div className={styles.fanInfo}>
                  <span className={styles.fanName}>{fan.name}</span>
                  <span className={styles.fanCity}>{fan.city} · Nv. {fan.level}</span>
                </div>
                <div className={styles.fanPoints}>
                  <span className={styles.fanPointsNum}>{formatPoints(fan.fanpoints)}</span>
                  {fan.trend === 'up'   && <span className={`${styles.trend} ${styles.trendUp}`}>▲</span>}
                  {fan.trend === 'down' && <span className={`${styles.trend} ${styles.trendDown}`}>▼</span>}
                  {fan.trend === 'same' && <span className={`${styles.trend} ${styles.trendSame}`}>—</span>}
                </div>
              </button>
            );
          })
        )}

        {!showAll && fans.length > top6.length && (
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
        <button type="button" className={styles.ctaPrimary} disabled>
          Ver missões diárias
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </footer>
    </aside>
  );
}
