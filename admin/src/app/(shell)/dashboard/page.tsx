'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import {
  IconUsers,
  IconStar,
  IconHeart,
  IconShield,
  IconFeed,
  IconDownload,
  IconCheck,
  IconAlert,
  IconLink,
} from '@/components/icons';
import { metricsService } from '@/services/metrics';
import { formatBRL, formatCompact, formatNumber, formatRelative } from '@/lib/format';
import type { ActivityEntry, Kpi, ChartSeries } from '@/types';
import styles from './page.module.css';

type Period = '7d' | '30d' | '90d';

/** Top-of-page tab selector per product feedback ("Dentro
 *  de dashboard, inclua uma tab, semelhante à configurações
 *  com os items Dados e Insights"). */
type DashTab = 'dados' | 'insights';

const DASH_TABS: { id: DashTab; label: string }[] = [
  { id: 'dados',    label: 'Dados' },
  { id: 'insights', label: 'Insights' },
];

const KPI_ICON: Record<string, React.ReactNode> = {
  mau:        <IconUsers size={14} />,
  signups:    <IconUsers size={14} />,
  revenue:    <IconStar size={14} />,
  posts:      <IconFeed size={14} />,
  reports:    <IconShield size={14} />,
  superfans:  <IconHeart size={14} />,
};

function formatKpi(k: Kpi): string {
  if (k.format === 'currency') return formatBRL(k.value);
  if (k.format === 'compact') return formatCompact(k.value);
  return formatNumber(k.value);
}

/* ── Motion-animated line chart ─────────────────────────── */

/** Formata ISO date pra DD/MM, fallback pro ISO se parse falhar.
 *  Usado pelo tooltip do LineChart pra mostrar o eixo X. */
function formatPointDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function LineChart({
  series,
  height = 220,
  strokeColors = ['var(--text)', 'var(--info)', 'var(--brand)'],
  /**
   * When true, each series is normalized to its OWN min-max range
   * before plotting. Use this when the series share an X axis but
   * have wildly different scales (e.g. signups in the hundreds vs
   * session minutes in the teens vs an engagement score 0-100) —
   * each line then uses the full vertical space and the SHAPE of
   * each is comparable even though the absolute values aren't.
   *
   * Without it, the lines all share a single y-scale based on the
   * overall min/max, which works when the series are commensurable
   * (active users vs new signups) but flattens any series with a
   * smaller magnitude into a horizontal noise floor.
   */
  normalizePerSeries = false,
}: {
  series: ChartSeries[];
  height?: number;
  strokeColors?: string[];
  normalizePerSeries?: boolean;
}) {
  // Hover state: x-index do ponto sob o cursor pra renderizar dot
  // ativo + tooltip. -1 = sem hover. Estado vive aqui no chart pra
  // todas as séries reagirem juntas (mesmo X = mesmo ponto temporal).
  const [hoverIdx, setHoverIdx] = useState<number>(-1);

  if (series.length === 0 || series[0].data.length === 0) return null;

  const w = 600;
  const h = height;
  const padX = 24;
  const padY = 16;

  // Per-series range when normalizing; one shared range otherwise.
  const seriesRanges = series.map((s) => {
    const values = s.data.map((p) => p.value);
    const sMin = Math.min(...values);
    const sMax = Math.max(...values);
    return { min: sMin, max: sMax, range: sMax - sMin || 1 };
  });
  const allValues = series.flatMap((s) => s.data.map((p) => p.value));
  const globalMin = Math.min(...allValues);
  const globalMax = Math.max(...allValues);
  const globalRange = globalMax - globalMin || 1;

  const points = series[0].data.length;
  const stepX = (w - padX * 2) / (points - 1);

  /* Per-series pixel coords pré-computadas — usadas por path,
   *  area, dots e tooltip. Calcular uma vez aqui evita refazer
   *  o math em cada branch de render. */
  const seriesCoords = series.map((s, idx) => {
    const { min, range } = normalizePerSeries
      ? seriesRanges[idx]
      : { min: globalMin, range: globalRange };
    return s.data.map((p, i) => ({
      x: padX + i * stepX,
      y: padY + (h - padY * 2) * (1 - (p.value - min) / range),
      value: p.value,
      /* SeriesPoint só carrega `date` (ISO). Formata aqui pro
       *  tooltip exibir DD/MM enxuto em vez do ISO completo. */
      label: formatPointDate(p.date),
    }));
  });

  const buildPath = (coords: { x: number; y: number }[]) =>
    coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
      .join(' ');

  const buildArea = (coords: { x: number; y: number }[]) =>
    `${buildPath(coords)} L ${(padX + (points - 1) * stepX).toFixed(2)},${h - padY} L ${padX},${h - padY} Z`;

  // Y grid lines (5 níveis: 0%, 25%, 50%, 75%, 100%).
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((p) => padY + (h - padY * 2) * p);

  /* Pointer event → snap pro ponto mais próximo no eixo X.
   *  Calcula a fração X do cursor relativa à área plotável
   *  (descontando padX) e arredonda pro índice do data point. */
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    /* xPx tá em pixels do viewport; viewBox é 600px wide com
     *  scaleX = rect.width / 600. Converte de volta pra coords
     *  do viewBox antes de calcular o índice. */
    const xVb = (xPx / rect.width) * w;
    const xInPlot = xVb - padX;
    const plotWidth = w - padX * 2;
    if (xInPlot < -8 || xInPlot > plotWidth + 8) {
      setHoverIdx(-1);
      return;
    }
    const frac = Math.max(0, Math.min(1, xInPlot / plotWidth));
    const idx = Math.round(frac * (points - 1));
    setHoverIdx(idx);
  };

  /* Tooltip — calcula posição em coords absolutas do viewBox.
   *  Renderiza só se hoverIdx ≥ 0; usa o primeiro series como
   *  base pra ancorar X (todas as séries compartilham o eixo X).
   *  Conteúdo: label do ponto + uma linha por série. */
  const hover = hoverIdx >= 0 && hoverIdx < points
    ? {
        x: seriesCoords[0][hoverIdx].x,
        label: seriesCoords[0][hoverIdx].label,
      }
    : null;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      width="100%"
      height={h}
      style={{ display: 'block' }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHoverIdx(-1)}
    >
      <defs>
        {series.map((s, i) => (
          <linearGradient key={s.id} id={`area-${s.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColors[i % strokeColors.length]} stopOpacity="0.18" />
            <stop offset="100%" stopColor={strokeColors[i % strokeColors.length]} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines — fade-in escalonado pra criar sensação de
          "carregando o eixo" antes das curvas desenharem. */}
      {gridLines.map((y, i) => (
        <motion.line
          key={i}
          x1={padX}
          x2={w - padX}
          y1={y}
          y2={y}
          stroke="var(--border-soft)"
          strokeWidth="1"
          strokeDasharray="2 4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
        />
      ))}

      {/* Séries — uma <g> por série. Ordem dos children importa:
          area atrás, linha em cima, dots por último. */}
      {series.map((s, i) => {
        const coords = seriesCoords[i];
        const stroke = strokeColors[i % strokeColors.length];
        const seriesDelay = 0.35 + i * 0.18;
        return (
          <g key={s.id}>
            {/* Area fill — fade-in depois da linha começar a
                desenhar. Não anima o path em si (custoso); só
                opacity. */}
            <motion.path
              d={buildArea(coords)}
              fill={`url(#area-${s.id})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.6,
                delay: seriesDelay + 0.4,
                ease: 'easeOut',
              }}
            />

            {/* Linha — draws progressively via pathLength 0 → 1.
                Esta é a animação chave do "Line graph" do motion:
                o stroke "se desenha" da esquerda pra direita. */}
            <motion.path
              d={buildPath(coords)}
              fill="none"
              stroke={stroke}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: {
                  duration: 1.1,
                  delay: seriesDelay,
                  ease: [0.22, 1, 0.36, 1],
                },
                opacity: { duration: 0.2, delay: seriesDelay },
              }}
            />

            {/* Dot ativo no hover — só renderiza pra essa série
                quando hoverIdx está num índice válido. Scale-in
                spring pra dar o "pop" característico. */}
            {hover && hoverIdx >= 0 && (
              <motion.circle
                cx={coords[hoverIdx].x}
                cy={coords[hoverIdx].y}
                r={4}
                fill={stroke}
                stroke="var(--surface-1, #0a0a0e)"
                strokeWidth="2"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              />
            )}
          </g>
        );
      })}

      {/* Hover guideline + tooltip. Linha vertical fina cruza o
          chart no X do ponto ativo; tooltip texto fica logo
          abaixo do topo do svg. */}
      {hover && (
        <>
          <motion.line
            x1={hover.x}
            x2={hover.x}
            y1={padY}
            y2={h - padY}
            stroke="var(--border-soft)"
            strokeWidth="1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 0.12 }}
          />
          <motion.text
            x={hover.x}
            y={padY - 4}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-mute)"
            initial={{ opacity: 0, y: padY - 8 }}
            animate={{ opacity: 1, y: padY - 4 }}
            transition={{ duration: 0.16 }}
          >
            {hover.label}
          </motion.text>
        </>
      )}
    </svg>
  );
}

/* ── Donut chart ────────────────────────────────────────── */

function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const size = 124;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--surface-3)"
        strokeWidth={stroke}
      />
      {data.map((d, i) => {
        const len = (d.value / total) * c;
        const dash = `${len} ${c - len}`;
        const offset = c - acc;
        acc += len;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={stroke}
            strokeDasharray={dash}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 200ms var(--ease-out)' }}
          />
        );
      })}
      <text
        x={size / 2}
        y={size / 2 - 2}
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fill="var(--text)"
      >
        {formatCompact(total)}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 12}
        textAnchor="middle"
        fontSize="9"
        fill="var(--text-mute)"
      >
        TOTAL
      </text>
    </svg>
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [dashTab, setDashTab] = useState<DashTab>('dados');
  const [kpis, setKpis] = useState<Kpi[] | null>(null);
  const [growth, setGrowth] = useState<ChartSeries[] | null>(null);
  const [postsByType, setPostsByType] = useState<{ label: string; value: number }[] | null>(null);
  const [planDist, setPlanDist] = useState<{ label: string; value: number; color: string }[] | null>(null);
  const [reportsByReason, setReportsByReason] = useState<{ label: string; value: number; color: string }[] | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    // allSettled: one metric failing doesn't kill the rest. Each card
    // gets a clean either-or path — populated on success, kept as
    // empty-state on failure (with the error in the console).
    Promise.allSettled([
      metricsService.kpis(),
      metricsService.growth(),
      metricsService.postsByType(),
      metricsService.planDistribution(),
      metricsService.reportsByReason(),
      metricsService.activity(),
    ]).then((results) => {
      const setters: ((v: unknown) => void)[] = [
        setKpis as (v: unknown) => void,
        setGrowth as (v: unknown) => void,
        setPostsByType as (v: unknown) => void,
        setPlanDist as (v: unknown) => void,
        setReportsByReason as (v: unknown) => void,
        setActivity as (v: unknown) => void,
      ];
      const labels = [
        'kpis',
        'growth',
        'postsByType',
        'planDistribution',
        'reportsByReason',
        'activity',
      ];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          setters[i](r.value);
        } else {
          console.error(`metricsService.${labels[i]} failed:`, r.reason);
          // Empty array keeps the card out of perpetual loading mode.
          setters[i]([]);
        }
      });
    });
  }, []);

  const maxBar = postsByType ? Math.max(...postsByType.map((b) => b.value)) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral da plataforma — atividade, crescimento e moderação."
        actions={
          <>
            <Tabs<Period>
              variant="pills"
              items={[
                { id: '7d',  label: '7 dias' },
                { id: '30d', label: '30 dias' },
                { id: '90d', label: '90 dias' },
              ]}
              value={period}
              onChange={setPeriod}
            />
            <Button variant="secondary" size="sm" leadingIcon={<IconDownload size={14} />}>
              Exportar
            </Button>
          </>
        }
        tabs={
          <Tabs<DashTab>
            variant="bordered"
            items={DASH_TABS}
            value={dashTab}
            onChange={setDashTab}
          />
        }
      />

      <div className={styles.body}>
        {dashTab === 'insights' && (
          <InsightsTab />
        )}
        {dashTab === 'dados' && (
          <>
        {/* KPI grid */}
        <div className={styles.kpiGrid}>
          {(kpis ?? Array(6).fill(null)).map((k, i) =>
            k ? (
              <StatCard
                key={k.id}
                label={k.label}
                value={formatKpi(k)}
                icon={KPI_ICON[k.id]}
                trend={k.trend}
                trendLabel={k.helperText}
                spark={k.spark}
                // The "online-users" tile is the only one that
                // reflects a real-time number — the live dot
                // signals that to the operator at a glance.
                live={k.id === 'online-users'}
              />
            ) : (
              <StatCard
                key={`s-${i}`}
                label="Carregando..."
                value="—"
                icon={null}
                trend={null}
              />
            )
          )}
        </div>

        {/* Growth chart + activity */}
        <div className={styles.row}>
          <Card className={styles.chartCard}>
            <div className={styles.chartHead}>
              <div>
                <div className={styles.chartTitle}>Crescimento da plataforma</div>
                <div className={styles.chartSubtitle}>
                  Novos usuários · tempo médio de sessão · score de engajamento — últimos 90 dias
                </div>
              </div>
              {/* Convention: "Em alta" badges use size="lg" platform-
                  wide so trending signals read as first-class status. */}
              <Badge tone="brand" size="lg" dot>Em alta</Badge>
            </div>
            <div className={styles.chartBody}>
              {/* Each series is normalized to its own min-max range so
                  signups (units) / session minutes / 0-100 score
                  share the chart without one flattening the others.
                  Trade-off: absolute Y values aren't comparable
                  across lines — we read SHAPE, not magnitude. The
                  legend below shows the current snapshot per
                  series so the absolute numbers stay one glance
                  away. */}
              {growth ? <LineChart series={growth} normalizePerSeries /> : null}
            </div>
            <div className={styles.legend}>
              {(growth ?? []).map((s, i) => {
                const last = s.data[s.data.length - 1]?.value ?? 0;
                const isMinutes = s.id === 'sessionMin';
                const isScore   = s.id === 'engagementScore';
                const formatted = isMinutes
                  ? `${last.toFixed(1)} min`
                  : isScore
                    ? `${last.toFixed(0)} / 100`
                    : formatNumber(last);
                // Stroke palette matches LineChart's default
                // strokeColors order: text → info → brand.
                const dotColor =
                  i === 0 ? 'var(--text)' :
                  i === 1 ? 'var(--info)' :
                  'var(--brand)';
                return (
                  <span key={s.id} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: dotColor }} />
                    {s.label} · <strong>{formatted}</strong>
                  </span>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Atividade recente" description="Últimas ações na plataforma" />
            <div className={styles.activityList}>
              {(activity ?? []).slice(0, 6).map((a) => (
                <div key={a.id} className={styles.activityItem}>
                  <div className={styles.activityBody}>
                    {/* Subject built as a single tokenised line so the
                        actor + the song/object stay bold and the
                        connective copy ("ouviu", " — ", etc.) recedes
                        to a muted gray. The backend sends us a
                        composite `subject` string ("Tocou X") which we
                        keep intact but display in muted weight; the
                        actor is bolded; the meta line shows artist +
                        points context in the same muted treatment. */}
                    <div className={styles.activitySubject}>
                      {a.actor && (
                        <>
                          <span className={styles.activityActor}>{a.actor.name}</span>{' '}
                        </>
                      )}
                      <span className={styles.activityCopy}>{a.subject}</span>
                    </div>
                    {a.meta && <div className={styles.activityMeta}>{a.meta}</div>}
                  </div>
                  <span className={styles.activityWhen}>{formatRelative(a.createdAt)}</span>
                </div>
              ))}
              {(activity?.length ?? 0) > 0 && (
                <a className={styles.activitySeeAll} href="/users">
                  Ver todas as atividades
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              )}
            </div>
          </Card>
        </div>

        {/* Bottom row removida per product feedback — saíram os
         * cards "Posts por tipo", "Distribuição de planos",
         * "Denúncias por motivo" e o aviso de mock layer. Quando
         * for re-habilitar algum deles, o JSX antigo fica no
         * histórico do git (commit anterior). */}
          </>
        )}
      </div>
    </>
  );
}

/* ============================================================
 * Insights tab
 *
 * Qualitative read of the platform's state — short narrative
 * cards a product owner / community lead can scan in 30s to
 * understand "what's working, what's noisy, what needs
 * attention". Numbers are mock today; when the real backend
 * surfaces aggregated trend deltas + sentiment scoring, swap
 * each card's source. Kept simple on purpose — the Dados tab
 * already shows the raw KPIs / charts; Insights is the
 * editorialized layer above them.
 * ============================================================ */

interface InsightCard {
  id: string;
  tone: 'positive' | 'attention' | 'neutral';
  title: string;
  body: string;
  metric?: string;
}

const INSIGHT_CARDS: InsightCard[] = [
  {
    id: 'engagement-up',
    tone: 'positive',
    title: 'Engajamento subindo entre superfãs',
    metric: '+18% likes/comentários nesta semana',
    body:
      'Os posts marcados como "Fanverse" estão acumulando 2.3× mais reações do que feed orgânico. A janela ideal pra publicar continua sendo 19h-21h em SP/RJ.',
  },
  {
    id: 'community-noise',
    tone: 'attention',
    title: 'Picos de moderação em Comunidades',
    metric: '12 denúncias abertas (high)',
    body:
      'A comunidade "Boiadeira Forever" concentra 7 das 12 denúncias da semana. Recomenda-se revisar regras + considerar moderador convidado pra cobrir o turno noturno.',
  },
  {
    id: 'streams-growth',
    tone: 'positive',
    title: 'Streams completos crescendo',
    metric: '94% taxa de conclusão (>75% da faixa)',
    body:
      'A maioria das sessões termina o vídeo até o fim — sinal forte de que o ranqueamento de "próxima música" está alinhado ao gosto. Mantenha o algoritmo atual.',
  },
  {
    id: 'inactive-cohort',
    tone: 'attention',
    title: 'Coorte inativa nos últimos 14 dias',
    metric: '~340 contas sem stream desde 6/maio',
    body:
      'Recomenda-se um pulso de re-engajamento (push + e-mail) usando o gatilho "Sua tribo curtiu X" — esse copy historicamente recupera 22% da coorte.',
  },
  {
    id: 'sentiment-feed',
    tone: 'neutral',
    title: 'Sentimento nos comentários do feed',
    metric: '78% positivo · 17% neutro · 5% negativo',
    body:
      'Distribuição saudável. Os 5% negativos concentram-se em posts patrocinados — possível indicativo de que o user-base prefere conteúdo orgânico.',
  },
  {
    id: 'growth-pacing',
    tone: 'neutral',
    title: 'Ritmo de novos cadastros',
    metric: '~62/dia (média 7d)',
    body:
      'Pacing estável. Aquisições via link de convite (Convites) responderam por 41% do total da semana — manter o programa ativo no próximo ciclo.',
  },
];

function InsightsTab() {
  return (
    <>
      <Card>
        <CardHeader
          title="Insights da semana"
          description="Leitura qualitativa do que está acontecendo na plataforma. Use junto com a aba Dados para contexto numérico."
        />
        <CardBody>
          <div className={styles.insightsGrid}>
            {INSIGHT_CARDS.map((c) => (
              <article key={c.id} className={`${styles.insightCard} ${styles[`insight-${c.tone}`] ?? ''}`}>
                <div className={styles.insightTitleRow}>
                  <span className={`${styles.insightDot} ${styles[`insightDot-${c.tone}`] ?? ''}`} aria-hidden="true" />
                  <h4 className={styles.insightTitle}>{c.title}</h4>
                </div>
                {c.metric && (
                  <p className={styles.insightMetric}>{c.metric}</p>
                )}
                <p className={styles.insightBody}>{c.body}</p>
              </article>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
