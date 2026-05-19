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

/* ── Benefits catalog (mock) ──
 *
 * Hard-coded benefits the user "owns" as they cross point
 * thresholds. Surfaced under the "Meus benefícios" tab; each
 * benefit ships with its own contextual icon (chat balloon for
 * Superchat, users-group for community access, percent-tag for
 * the store discount, paper-airplane for direct messages,
 * crown for the gold skin, ticket for VIP show invites) so the
 * row reads at a glance even before you scan the title text.
 *
 * Replace this hard-coded list with the live benefits API
 * response when the backend grows one. */
type BenefitIconKind =
  | 'chat'
  | 'community'
  | 'discount'
  | 'send'
  | 'crown'
  | 'ticket';

interface Benefit {
  id: string;
  title: string;
  description: string;
  /** Minimum Fanpoints the user needs to unlock this benefit. */
  threshold: number;
  icon: BenefitIconKind;
}
const BENEFITS: Benefit[] = [
  {
    id: 'b1',
    title: 'Superchat global',
    description: 'Converse no Superchat com toda a comunidade Fanverse',
    threshold: 0,
    icon: 'chat',
  },
  {
    id: 'b2',
    title: 'Comunidades exclusivas',
    description: 'Acesso aos grupos Boiadeiros e Fãs do Forró',
    threshold: 500,
    icon: 'community',
  },
  {
    id: 'b3',
    title: '15% OFF na Loja da Boiadeira',
    description: 'Cupom aplicado automaticamente no checkout',
    threshold: 1000,
    icon: 'discount',
  },
  {
    id: 'b4',
    title: 'Mensagem direta para Ana',
    description: 'Envie 1 mensagem por mês com prioridade na inbox',
    threshold: 2500,
    icon: 'send',
  },
  {
    id: 'b5',
    title: 'Skin dourada de avatar',
    description: 'Anel dourado no seu avatar em todas as superfícies',
    threshold: 5000,
    icon: 'crown',
  },
  {
    id: 'b6',
    title: 'Convites VIP para shows',
    description: 'Pré-venda exclusiva de ingressos antes do público geral',
    threshold: 10000,
    icon: 'ticket',
  },
];

/** Renders the contextual SVG for each benefit. Centralized here
 *  so the JSX inside the benefits list stays focused on layout
 *  rather than icon path data. */
function BenefitIcon({ kind }: { kind: BenefitIconKind }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor' as const,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'chat':
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
        </svg>
      );
    case 'community':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2 20c1-3.5 3.6-5.5 7-5.5s6 2 7 5.5" />
          <circle cx="17" cy="9.5" r="2.5" />
          <path d="M16 14.4c1.2 0 2.3.2 3.2.7 1.5.8 2.5 2.2 2.9 4" />
        </svg>
      );
    case 'discount':
      return (
        <svg {...common}>
          <path d="M20.6 13.3l-7.3 7.3a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.7z" />
          <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'send':
      return (
        <svg {...common}>
          <path d="M21.5 2.5L11 13M21.5 2.5L14.5 21.5L10.5 13L2 9L21.5 2.5z" />
        </svg>
      );
    case 'crown':
      return (
        <svg {...common}>
          <path d="M2.5 19h19l-1.5-9-5 3.5L12 6l-3 7.5L4 10l-1.5 9z" />
        </svg>
      );
    case 'ticket':
      return (
        <svg {...common} strokeWidth={1.8}>
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a1.5 1.5 0 0 0 0-3z" />
          <path d="M9 5v14" />
        </svg>
      );
  }
}

type Tab = 'ranking' | 'benefits';

export default function SuperfansPanel({ open, onClose }: SuperfansPanelProps) {
  const { user: authUser } = useAuth();
  const { ranking, loading, error } = useRanking(open);

  // Phase: 'idle' = unmounted; 'in' = rise; 'open' = idle visible; 'out' = fall.
  const [phase, setPhase] = useState<'idle' | 'in' | 'open' | 'out'>(open ? 'in' : 'idle');
  const [showAll, setShowAll] = useState(false);
  /** Active tab. Defaults to ranking — the panel's primary
   *  function — with the benefits tab as a secondary view. */
  const [tab, setTab] = useState<Tab>('ranking');

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

  // Top-10 distance — replaces the previous "level X / Y to next
  // level" line per product feedback. We compute it from the
  // current ranking: the rank-10 fan's point total is the
  // threshold to enter the top 10. If the user is already in
  // the top 10 (or the ranking is shorter than 10), the copy
  // shifts to a celebratory variant instead of a number.
  const top10Threshold =
    fans.length >= 10 ? fans[9].fanpoints : null;
  const meInTop10 = me ? me.rank <= 10 : false;
  const pointsToTop10 =
    me && top10Threshold !== null
      ? Math.max(0, top10Threshold + 1 - me.fanpoints)
      : 0;
  // Progress bar fill ratio also pinned to top-10 progress now
  // (was: progress toward next level). Capped at 100%; when the
  // user is already in top 10 we show a full bar.
  const meProgressPct = me
    ? meInTop10 || top10Threshold === null
      ? 100
      : Math.min(100, Math.max(0, Math.round((me.fanpoints / Math.max(1, top10Threshold)) * 100)))
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
        {/* Mirrors the close button on the opposite side so the title
            reads centered in a plain flex row — no absolute layout. */}
        <span className={styles.headerSpacer} aria-hidden="true" />
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
            </div>
            <div className={styles.meInfo}>
              <span className={styles.meName}>{me.name}</span>
              <span className={styles.meCity}>{me.city}</span>
              {/* The "Meus benefícios" CTA that used to sit here
                  was promoted to a top-level tab next to "Ranking"
                  (see the .tabs row below) per product feedback. */}
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
            {/* Single label that replaces the previous
                "Nível N / X para nível N+1" pair per product
                feedback. Shows the distance in points to enter
                the top 10, or a "you're already in" line when
                the user has crossed that threshold. */}
            <div className={styles.meProgressLabel}>
              {meInTop10 ? (
                <span>Você está no Top 10!</span>
              ) : top10Threshold === null ? (
                <span>Continue ouvindo pra entrar no ranking</span>
              ) : (
                <span>
                  {formatPoints(pointsToTop10)} pontos para entrar no top 10
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      <div className={styles.divider} />

      {/* Tabs — Ranking (default) and Meus benefícios. Both share
          the same outer envelope; only the body below switches. */}
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ranking'}
          className={`${styles.tab} ${tab === 'ranking' ? styles.tabActive : ''}`}
          onClick={() => setTab('ranking')}
        >
          Ranking
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'benefits'}
          className={`${styles.tab} ${tab === 'benefits' ? styles.tabActive : ''}`}
          onClick={() => setTab('benefits')}
        >
          Meus benefícios
        </button>
      </div>

      {/* Body — switches between Ranking and Benefits based on
          the active tab. Both branches share the same `.list`
          container so the surrounding chrome (padding,
          scrolling) stays consistent.
          Benefits view splits the catalog by threshold:
            - Unlocked perks at the top (rendered with a subtle
              lilac tint via the .benefitUnlocked modifier).
            - "Próximos níveis" section below listing the perks
              the user hasn't earned yet, with the points-to-
              unlock subtitle in place of the description. */}
      {tab === 'benefits' ? (
        (() => {
          const mePts = me?.fanpoints ?? 0;
          const unlocked = BENEFITS.filter((b) => mePts >= b.threshold);
          const locked = BENEFITS.filter((b) => mePts < b.threshold);
          return (
            <div className={styles.list}>
              {unlocked.map((b) => (
                <div
                  key={b.id}
                  className={`${styles.benefitRow} ${styles.benefitUnlocked}`}
                >
                  <span className={styles.benefitIcon} aria-hidden="true">
                    <BenefitIcon kind={b.icon} />
                  </span>
                  <div className={styles.benefitInfo}>
                    <span className={styles.benefitTitle}>{b.title}</span>
                    <span className={styles.benefitDesc}>{b.description}</span>
                  </div>
                </div>
              ))}

              {locked.length > 0 && (
                <>
                  <h3 className={styles.benefitsSectionTitle}>
                    Próximos níveis
                  </h3>
                  {locked.map((b) => {
                    const missing = Math.max(0, b.threshold - mePts);
                    return (
                      <div
                        key={b.id}
                        className={`${styles.benefitRow} ${styles.benefitLocked}`}
                      >
                        <span className={styles.benefitIcon} aria-hidden="true">
                          <BenefitIcon kind={b.icon} />
                        </span>
                        <div className={styles.benefitInfo}>
                          <span className={styles.benefitTitle}>{b.title}</span>
                          <span className={styles.benefitDesc}>
                            Faltam {formatPoints(missing)} pontos para desbloquear
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })()
      ) : (
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
                  {/* Crown emoji on the rank-1 fan removed per product
                      feedback — the 🥇 in the rank column already
                      carries the "first place" cue, and stacking two
                      gold accents read as busy. */}
                </div>
                <div className={styles.fanInfo}>
                  <span className={styles.fanName}>{fan.name}</span>
                  <span className={styles.fanCity}>{fan.city}</span>
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
      )}
    </aside>
  );
}
