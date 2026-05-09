import type { ChartSeries, Kpi, SeriesPoint } from '@/types';

/* ── KPI cards on dashboard ───────────────────────────────── */

export const MOCK_KPIS: Kpi[] = [
  {
    id: 'mau',
    label: 'Usuários ativos (MAU)',
    value: 84_120,
    trend: 0.124,
    spark: [42100, 44230, 46010, 48280, 51190, 54420, 58210, 61020, 64810, 68210, 73420, 78110, 84120],
    format: 'integer',
    helperText: 'vs 30 dias atrás',
  },
  {
    id: 'signups',
    label: 'Novos cadastros',
    value: 2_142,
    trend: 0.082,
    spark: [120, 134, 142, 150, 168, 174, 188, 192, 201, 218, 232, 246, 251],
    format: 'integer',
    helperText: 'últimos 30 dias',
  },
  {
    id: 'revenue',
    label: 'Receita',
    value: 184_320,
    trend: 0.214,
    spark: [98000, 102000, 108000, 112000, 121000, 134000, 142000, 151000, 158000, 162000, 171000, 178000, 184320],
    format: 'currency',
    helperText: 'MRR atual',
  },
  {
    id: 'posts',
    label: 'Conteúdos publicados',
    value: 12_840,
    trend: 0.046,
    spark: [820, 870, 905, 942, 980, 1020, 1060, 1110, 1180, 1240, 1290, 1340, 1410],
    format: 'integer',
    helperText: 'últimos 30 dias',
  },
  {
    id: 'reports',
    label: 'Denúncias pendentes',
    value: 12,
    trend: -0.31,
    spark: [22, 24, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 12],
    format: 'integer',
    helperText: 'aberta · prioridade alta',
  },
  {
    id: 'superfans',
    label: 'Superfãs ativos',
    value: 4_280,
    trend: 0.068,
    spark: [3200, 3280, 3340, 3410, 3490, 3580, 3660, 3740, 3820, 3920, 4020, 4150, 4280],
    format: 'integer',
    helperText: 'top 5% engajados',
  },
];

/* ── Time-series for line chart (90 days, weekly aggregation) ── */

function makeSeries(baseValue: number, drift: number, jitter: number, points: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let v = baseValue;
  const now = Date.now();
  for (let i = points - 1; i >= 0; i--) {
    v = v + drift + (Math.sin(i * 0.7) * jitter);
    out.push({
      date: new Date(now - i * 86_400_000).toISOString(),
      value: Math.round(Math.max(0, v)),
    });
  }
  return out;
}

export const MOCK_GROWTH: ChartSeries[] = [
  { id: 'mau',     label: 'Usuários ativos', data: makeSeries(42000, 480, 800, 90) },
  { id: 'signups', label: 'Novos cadastros', data: makeSeries(120,    2,  18, 90) },
];

export const MOCK_REVENUE: ChartSeries[] = [
  { id: 'mrr', label: 'MRR (BRL)', data: makeSeries(98_000, 950, 2200, 90) },
];

/* ── Bar chart: posts by type ─────────────────────────────── */

export const POSTS_BY_TYPE: { label: string; value: number }[] = [
  { label: 'Áudio', value: 5_120 },
  { label: 'Vídeo', value: 3_410 },
  { label: 'Imagem', value: 2_840 },
  { label: 'Texto', value: 1_470 },
];

/* ── Donut: plan distribution ─────────────────────────────── */

export const PLAN_DISTRIBUTION: { label: string; value: number; color: string }[] = [
  { label: 'Free',     value: 62_400, color: 'var(--text-mute)' },
  { label: 'Plus',     value: 17_440, color: 'var(--info)' },
  { label: 'Superfã',  value: 4_280,  color: 'var(--brand)' },
];

/* ── Donut: report reasons ────────────────────────────────── */

export const REPORTS_BY_REASON: { label: string; value: number; color: string }[] = [
  { label: 'Spam',           value: 42, color: 'var(--info)' },
  { label: 'Assédio',        value: 28, color: 'var(--warning)' },
  { label: 'Discurso ódio',  value: 14, color: 'var(--danger)' },
  { label: 'Direitos autorais', value: 9, color: 'var(--neutral)' },
  { label: 'Outros',         value: 18, color: 'var(--text-mute)' },
];
