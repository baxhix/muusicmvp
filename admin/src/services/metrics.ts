import { api } from './api';
import type { ChartSeries, Kpi, ActivityEntry, ActivityType } from '@/types';

/* ── Backend response shapes ─────────────────────────────── */

interface BackendKpis {
  totalUsers: number;
  onlineUsers: number;
  totalMessages: number;
  totalTracks: number;
  totalListeningEvents: number;
  totalConversations: number;
  unreadNotifications: number;
}

interface BackendGrowthPoint {
  day: string; // YYYY-MM-DD
  newUsers: number;
}

interface BackendActivity {
  id: string;
  kind: 'stream' | 'login' | 'chat_started';
  points: number;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  trackTitle: string | null;
  trackArtist: string | null;
  conversationSlug: string | null;
}

/* ── Mappers ─────────────────────────────────────────────── */

/**
 * Build the Kpi[] tile array consumed by the dashboard from the flat
 * backend payload. Each tile carries domain-meaningful helper text so
 * the UI stays agnostic. Sparklines are zeroed — the dedicated growth
 * chart already shows the time-series, no need to duplicate.
 */
function mapKpis(b: BackendKpis): Kpi[] {
  const emptySpark = Array.from({ length: 12 }, () => 0);
  return [
    {
      id: 'total-users',
      label: 'Usuários cadastrados',
      value: b.totalUsers,
      trend: null,
      spark: emptySpark,
      format: 'integer',
      helperText: 'Contas com magic-link verificado',
    },
    {
      id: 'online-users',
      label: 'Online agora',
      value: b.onlineUsers,
      trend: null,
      spark: emptySpark,
      format: 'integer',
      helperText: 'Sessões com last_seen_at < 60s',
    },
    {
      id: 'total-listens',
      label: 'Reproduções totais',
      value: b.totalListeningEvents,
      trend: null,
      spark: emptySpark,
      format: 'compact',
      helperText: 'Linhas em listening_history',
    },
    {
      id: 'total-messages',
      label: 'Mensagens no chat',
      value: b.totalMessages,
      trend: null,
      spark: emptySpark,
      format: 'compact',
      helperText: 'Soma DMs + Superchat',
    },
    {
      id: 'total-tracks',
      label: 'Catálogo de músicas',
      value: b.totalTracks,
      trend: null,
      spark: emptySpark,
      format: 'integer',
      helperText: 'Faixas no catálogo `tracks`',
    },
    {
      id: 'total-conversations',
      label: 'Conversas abertas',
      value: b.totalConversations,
      trend: null,
      spark: emptySpark,
      format: 'integer',
      helperText: 'DMs + grupos (Superchat)',
    },
  ];
}

/**
 * Backend returns daily new-user counts; the dashboard chart consumes
 * ChartSeries[]. Emit a single "Novos cadastros" line — when more
 * series get tracked (active users, churned, etc.) they get added
 * to this array without touching the dashboard page.
 */
function mapGrowth(points: BackendGrowthPoint[]): ChartSeries[] {
  return [
    {
      id: 'new-users',
      label: 'Novos cadastros por dia',
      data: points.map((p) => ({
        date: new Date(p.day).toISOString(),
        value: p.newUsers,
      })),
    },
  ];
}

const KIND_TO_TYPE: Record<BackendActivity['kind'], ActivityType> = {
  stream: 'post.published',
  login: 'user.signup',
  chat_started: 'post.published',
};

/**
 * Map raw user_activities rows into the activity-feed shape. We
 * collapse the three kinds onto the closest matching ActivityType
 * the admin UI knows about — when the admin grows distinct icons
 * for stream/login/chat_started, expand the enum.
 */
function mapActivity(rows: BackendActivity[]): ActivityEntry[] {
  return rows.map((r): ActivityEntry => {
    const actorName = r.user.name?.trim() || r.user.email.split('@')[0];
    let subject = '';
    let meta: string | undefined;
    if (r.kind === 'stream' && r.trackTitle) {
      subject = `Tocou ${r.trackTitle}`;
      if (r.trackArtist) meta = r.trackArtist;
    } else if (r.kind === 'login') {
      subject = 'Fez login na plataforma';
    } else if (r.kind === 'chat_started') {
      subject =
        r.conversationSlug === 'superchat'
          ? 'Entrou no Superchat'
          : 'Iniciou uma conversa';
    } else {
      subject = 'Atividade';
    }
    return {
      id: r.id,
      type: KIND_TO_TYPE[r.kind],
      kind: r.kind,
      actor: {
        id: r.user.id,
        name: actorName,
        avatar: r.user.avatarUrl ?? undefined,
      },
      subject,
      meta: meta ? `${meta} · +${r.points} pts` : `+${r.points} pts`,
      createdAt: r.createdAt,
    };
  });
}

/* ── Service ─────────────────────────────────────────────── */

export const metricsService = {
  kpis: async (): Promise<Kpi[]> => {
    const res = await api.get<{ kpis: BackendKpis }>('/api/admin/kpis');
    return mapKpis(res.kpis);
  },

  growth: async (): Promise<ChartSeries[]> => {
    const res = await api.get<{ points: BackendGrowthPoint[] }>(
      '/api/admin/growth?days=30',
    );
    return mapGrowth(res.points);
  },

  activity: async (): Promise<ActivityEntry[]> => {
    const res = await api.get<{ items: BackendActivity[]; hasMore: boolean }>(
      '/api/admin/activities?limit=50',
    );
    return mapActivity(res.items);
  },

  // ── No backing data yet — return empty arrays so the chart cards
  // render in their empty state instead of mixing fake mock numbers
  // alongside the real KPIs above. When billing / moderation / plan
  // tracking lands, these get real endpoints just like the others.
  revenue:          async (): Promise<ChartSeries[]> => [],
  postsByType:      async () => [] as { label: string; value: number }[],
  planDistribution: async () =>
    [] as { label: string; value: number; color: string }[],
  reportsByReason:  async () =>
    [] as { label: string; value: number; color: string }[],
};
