'use client';

import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import {
  IconUsers,
  IconStar,
  IconTrendingUp,
  IconHeart,
  IconFeed,
  IconChevronRight,
} from '@/components/icons';
import { formatCompact, formatNumber } from '@/lib/format';
import styles from './page.module.css';

/* ── Mock data ──────────────────────────────────────────────
 * Each universe is a self-contained slice of the platform tied to
 * an artist or collective. The shape below is what the eventual
 * /api/admin/fanverse endpoint will return — kept here as mocks so
 * the UI is finalizable before the backend lands.
 * ──────────────────────────────────────────────────────────── */

interface Universe {
  id: string;
  name: string;
  tag: string;
  description: string;
  coverUrl: string;
  /** Display gradient tint behind the cover (CSS color stop). */
  accentColor: string;
  stats: {
    totalSuperfans: number;
    onlineSuperfans: number;
    totalPlays: number;
    messagesThisWeek: number;
    newSuperfansThisWeek: number;
    engagementRate: number; // 0-1 ratio
  };
}

const UNIVERSES: Universe[] = [
  {
    id: 'ana-castela',
    name: 'Fanverse Ana Castela',
    tag: 'Sertanejo',
    description:
      'Universo da Boiadeira — superfãs, atividade ao redor do mapa e moderação dos shows.',
    coverUrl:
      'https://i.scdn.co/image/ab67616d0000b273148cc2bf987ec2f4964d49fa',
    accentColor: '#D97706',
    stats: {
      totalSuperfans: 18420,
      onlineSuperfans: 312,
      totalPlays: 1_283_044,
      messagesThisWeek: 9842,
      newSuperfansThisWeek: 624,
      engagementRate: 0.42,
    },
  },
  {
    id: 'countrybeat',
    name: 'Fanverse Countrybeat',
    tag: 'Country',
    description:
      'Coletivo Countrybeat — comunidades, lançamentos colaborativos e Superchats temáticos.',
    coverUrl:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
    accentColor: '#0F766E',
    stats: {
      totalSuperfans: 6210,
      onlineSuperfans: 84,
      totalPlays: 421_336,
      messagesThisWeek: 2104,
      newSuperfansThisWeek: 119,
      engagementRate: 0.31,
    },
  },
];

/* ── Aggregated KPIs (sum of all universes) ──────────────── */
function aggregate(unis: Universe[]) {
  return unis.reduce(
    (acc, u) => ({
      totalSuperfans: acc.totalSuperfans + u.stats.totalSuperfans,
      onlineSuperfans: acc.onlineSuperfans + u.stats.onlineSuperfans,
      totalPlays: acc.totalPlays + u.stats.totalPlays,
      messagesThisWeek: acc.messagesThisWeek + u.stats.messagesThisWeek,
    }),
    {
      totalSuperfans: 0,
      onlineSuperfans: 0,
      totalPlays: 0,
      messagesThisWeek: 0,
    },
  );
}

/* ── Tiny live dot — inline copy of the StatCard version so the
 * universe stat tiles can carry the same visual. Animation defined
 * in page.module.css.
 * ─────────────────────────────────────────────────────────── */
function LiveDot() {
  return (
    <span className={styles.liveDot} aria-label="live" role="img">
      <span className={styles.liveDotHalo} aria-hidden="true" />
      <span className={styles.liveDotCore} aria-hidden="true" />
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function FanversePage() {
  const totals = aggregate(UNIVERSES);

  return (
    <>
      <PageHeader
        title="Fanverse"
        description="Universos exclusivos dos artistas — superfãs, atividade e moderação por mundo."
        actions={
          <Badge tone="brand" size="lg" dot>
            {UNIVERSES.length} universos ativos
          </Badge>
        }
      />

      <div className={styles.body}>
        {/* Top-level KPI row: numbers across every universe combined. */}
        <div className={styles.kpiGrid}>
          <StatCard
            label="Superfãs no Fanverse"
            value={formatNumber(totals.totalSuperfans)}
            icon={<IconStar size={14} />}
            trendLabel="Soma de todos os universos"
          />
          <StatCard
            label="Online agora"
            value={formatNumber(totals.onlineSuperfans)}
            icon={<IconUsers size={14} />}
            trendLabel="Sessões com last_seen < 60s"
            live
          />
          <StatCard
            label="Reproduções acumuladas"
            value={formatCompact(totals.totalPlays)}
            icon={<IconHeart size={14} />}
            trendLabel="Plays no catálogo de cada universo"
          />
          <StatCard
            label="Mensagens (7 dias)"
            value={formatCompact(totals.messagesThisWeek)}
            icon={<IconFeed size={14} />}
            trendLabel="Chats + Superchats por universo"
          />
        </div>

        {/* Universe cards — one per artist universe. */}
        <div className={styles.universeGrid}>
          {UNIVERSES.map((u) => (
            <UniverseCard key={u.id} universe={u} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Universe card ───────────────────────────────────────── */

function UniverseCard({ universe: u }: { universe: Universe }) {
  const onlinePct =
    u.stats.totalSuperfans > 0
      ? (u.stats.onlineSuperfans / u.stats.totalSuperfans) * 100
      : 0;

  return (
    <article className={styles.universe}>
      <div
        className={styles.universeCover}
        style={{
          backgroundImage: `url(${u.coverUrl})`,
          // Tint the gradient overlay slightly with the universe's
          // accent so each card has its own thermal signature.
          ['--accent' as string]: u.accentColor,
        }}
      >
        <div className={styles.universeCoverOverlay} />
        <header className={styles.universeHeader}>
          <span className={styles.universeName}>{u.name}</span>
          <span
            className={styles.universeTag}
            style={{
              background: `${u.accentColor}40`,
              border: `1px solid ${u.accentColor}80`,
              color: '#ffffff',
            }}
          >
            {u.tag}
          </span>
        </header>
      </div>

      <div className={styles.universeBody}>
        <p className={styles.universeDesc}>{u.description}</p>

        <div className={styles.statGrid}>
          <div className={styles.statTile}>
            <span className={styles.statValue}>
              {formatNumber(u.stats.totalSuperfans)}
            </span>
            <span className={styles.statLabel}>Superfãs</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>
              <LiveDot />
              {formatNumber(u.stats.onlineSuperfans)}
            </span>
            <span className={styles.statLabel}>Online agora</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>
              {formatCompact(u.stats.totalPlays)}
            </span>
            <span className={styles.statLabel}>Reproduções</span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statValue}>
              +{formatNumber(u.stats.newSuperfansThisWeek)}
            </span>
            <span className={styles.statLabel}>Novos (7d)</span>
          </div>
        </div>

        <div className={styles.universeFooter}>
          <span className={styles.engagementBadge}>
            <IconTrendingUp size={11} />
            {(u.stats.engagementRate * 100).toFixed(0)}% engajamento
          </span>
          <button
            type="button"
            className={styles.openLink}
            // Placeholder — universe detail surface is a follow-up.
            onClick={() => {
              console.log(`open universe: ${u.id}`);
            }}
          >
            Abrir universo
            <IconChevronRight size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}
