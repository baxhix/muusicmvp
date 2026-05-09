'use client';

import { useEffect, useState } from 'react';
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

/* ── Inline SVG line chart ──────────────────────────────── */

function LineChart({
  series,
  height = 220,
  strokeColors = ['var(--text)', 'var(--info)'],
}: {
  series: ChartSeries[];
  height?: number;
  strokeColors?: string[];
}) {
  if (series.length === 0 || series[0].data.length === 0) return null;

  const w = 600;
  const h = height;
  const padX = 24;
  const padY = 16;

  const allValues = series.flatMap((s) => s.data.map((p) => p.value));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const points = series[0].data.length;
  const stepX = (w - padX * 2) / (points - 1);

  const buildPath = (s: ChartSeries) =>
    s.data
      .map((p, i) => {
        const x = padX + i * stepX;
        const y = padY + (h - padY * 2) * (1 - (p.value - min) / range);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

  const buildArea = (s: ChartSeries) =>
    `${buildPath(s)} L ${(padX + (points - 1) * stepX).toFixed(2)},${h - padY} L ${padX},${h - padY} Z`;

  // Y grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((p) => padY + (h - padY * 2) * p);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      width="100%"
      height={h}
      style={{ display: 'block' }}
    >
      <defs>
        {series.map((s, i) => (
          <linearGradient key={s.id} id={`area-${s.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColors[i % strokeColors.length]} stopOpacity="0.18" />
            <stop offset="100%" stopColor={strokeColors[i % strokeColors.length]} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {gridLines.map((y, i) => (
        <line
          key={i}
          x1={padX}
          x2={w - padX}
          y1={y}
          y2={y}
          stroke="var(--border-soft)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
      ))}
      {series.map((s, i) => (
        <g key={s.id}>
          <path d={buildArea(s)} fill={`url(#area-${s.id})`} />
          <path
            d={buildPath(s)}
            fill="none"
            stroke={strokeColors[i % strokeColors.length]}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
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

/* ── Activity icon ──────────────────────────────────────── */

function ActivityIcon({ type }: { type: ActivityEntry['type'] }) {
  switch (type) {
    case 'user.signup':       return <IconUsers size={14} />;
    case 'user.banned':       return <IconAlert size={14} />;
    case 'user.suspended':    return <IconShield size={14} />;
    case 'post.published':    return <IconFeed size={14} />;
    case 'post.removed':      return <IconAlert size={14} />;
    case 'report.opened':     return <IconShield size={14} />;
    case 'report.resolved':   return <IconCheck size={14} />;
    case 'payout.completed':  return <IconStar size={14} />;
  }
}

/* ── Page ───────────────────────────────────────────────── */

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [kpis, setKpis] = useState<Kpi[] | null>(null);
  const [growth, setGrowth] = useState<ChartSeries[] | null>(null);
  const [postsByType, setPostsByType] = useState<{ label: string; value: number }[] | null>(null);
  const [planDist, setPlanDist] = useState<{ label: string; value: number; color: string }[] | null>(null);
  const [reportsByReason, setReportsByReason] = useState<{ label: string; value: number; color: string }[] | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    Promise.all([
      metricsService.kpis(),
      metricsService.growth(),
      metricsService.postsByType(),
      metricsService.planDistribution(),
      metricsService.reportsByReason(),
      metricsService.activity(),
    ]).then(([k, g, pt, pd, rr, a]) => {
      setKpis(k);
      setGrowth(g);
      setPostsByType(pt);
      setPlanDist(pd);
      setReportsByReason(rr);
      setActivity(a);
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
      />

      <div className={styles.body}>
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
                <div className={styles.chartSubtitle}>Usuários ativos × novos cadastros nos últimos 90 dias</div>
              </div>
              <Badge tone="brand" dot>Em alta</Badge>
            </div>
            <div className={styles.chartBody}>
              {growth ? <LineChart series={growth} /> : null}
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: 'var(--text)' }} />
                Usuários ativos
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: 'var(--info)' }} />
                Novos cadastros
              </span>
            </div>
          </Card>

          <Card>
            <CardHeader title="Atividade recente" description="Últimas ações na plataforma" />
            <div className={styles.activityList}>
              {(activity ?? []).slice(0, 6).map((a) => (
                <div key={a.id} className={styles.activityItem}>
                  <span className={styles.activityIcon}>
                    <ActivityIcon type={a.type} />
                  </span>
                  <div className={styles.activityBody}>
                    <div className={styles.activitySubject}>
                      {a.actor && (
                        <>
                          <span className={styles.activityActor}>{a.actor.name}</span>{' '}
                        </>
                      )}
                      {a.subject}
                    </div>
                    {a.meta && <div className={styles.activityMeta}>{a.meta}</div>}
                  </div>
                  <span className={styles.activityWhen}>{formatRelative(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Bottom row: posts by type · plan distribution · reports by reason */}
        <div className={styles.row} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <Card>
            <CardHeader title="Posts por tipo" description="Conteúdo publicado nos últimos 30 dias" />
            <div className={styles.bars}>
              {(postsByType ?? []).map((b) => (
                <div key={b.label} className={styles.barRow}>
                  <span className={styles.barLabel}>{b.label}</span>
                  <span className={styles.barTrack}>
                    <span
                      className={styles.barFill}
                      style={{ width: `${(b.value / maxBar) * 100}%` }}
                    />
                  </span>
                  <span className={styles.barValue}>{formatNumber(b.value)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Distribuição de planos" description="Base atual" />
            <div className={styles.donut}>
              {planDist && <Donut data={planDist} />}
              <div className={styles.donutLegend}>
                {(planDist ?? []).map((d) => (
                  <div key={d.label} className={styles.donutLegendRow}>
                    <span className={styles.donutDot} style={{ background: d.color }} />
                    <span>{d.label}</span>
                    <span className={styles.donutValue}>{formatCompact(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Denúncias por motivo" description="Últimos 30 dias" />
            <div className={styles.donut}>
              {reportsByReason && <Donut data={reportsByReason} />}
              <div className={styles.donutLegend}>
                {(reportsByReason ?? []).map((d) => (
                  <div key={d.label} className={styles.donutLegendRow}>
                    <span className={styles.donutDot} style={{ background: d.color }} />
                    <span>{d.label}</span>
                    <span className={styles.donutValue}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardBody>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, color: 'var(--text-mute)' }}>
              <IconLink size={14} />
              Camada mock ativa — todos os dados acima vêm de <code style={{ fontFamily: 'var(--font-mono)' }}>src/data/mock</code>. O ponto único de troca para a API real está em <code style={{ fontFamily: 'var(--font-mono)' }}>src/services/api.ts</code>.
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
