'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table, { type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import StatTile from '@/components/admin/StatTile';
import SuperfanDetailDrawer from '@/components/admin/SuperfanDetailDrawer';
import {
  IconStar,
  IconHeart,
  IconMusic,
  IconDownload,
} from '@/components/icons';
import { superfansService } from '@/services/superfans';
import { formatBRL, formatCompact, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Superfan } from '@/types';
import styles from './page.module.css';

const SEGMENT_LABEL: Record<Superfan['segment'], string> = {
  vip:    'VIP',
  loyal:  'Fiel',
  rising: 'Em ascensão',
  new:    'Novo',
};
const SEGMENT_TONE: Record<Superfan['segment'], BadgeTone> = {
  vip:    'brand',
  loyal:  'warning',
  rising: 'info',
  new:    'neutral',
};

const SEGMENT_OPTIONS = [
  { value: '',       label: 'Todos os segmentos' },
  { value: 'vip',    label: 'VIP' },
  { value: 'loyal',  label: 'Fiel' },
  { value: 'rising', label: 'Em ascensão' },
  { value: 'new',    label: 'Novo' },
];

function formatListenTime(minutes: number): string {
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
  }
  return `${minutes} min`;
}

export default function SuperfansPage() {
  const [superfans, setSuperfans] = useState<Superfan[] | null>(null);
  const [filters, setFilters] = useState({ name: '', segment: '', tag: '' });
  const [selected, setSelected] = useState<Superfan | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    superfansService.list().then(setSuperfans);
  }, []);

  const allTags = useMemo(() => {
    if (!superfans) return [];
    const set = new Set<string>();
    superfans.forEach((s) => s.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [superfans]);

  /* ── KPIs ─────────────────────────────────── */
  const kpis = useMemo(() => {
    if (!superfans) return null;
    const total = superfans.length;
    const totalRevenue = superfans.reduce((acc, s) => acc + s.totalSpentBRL, 0);
    const totalListenMinutes = superfans.reduce((acc, s) => acc + s.totalListenMinutes, 0);
    const avgDays = total > 0
      ? Math.round(superfans.reduce((acc, s) => acc + s.daysActive, 0) / total)
      : 0;
    return {
      total,
      totalRevenue,
      totalListenMinutes,
      avgDays,
    };
  }, [superfans]);

  /* ── Filtered ─────────────────────────────── */
  const filtered = useMemo(() => {
    if (!superfans) return [];
    const q = filters.name.trim().toLowerCase();
    return superfans
      .filter((s) => {
        if (q && !s.user.name.toLowerCase().includes(q) && !s.user.handle.toLowerCase().includes(q)) {
          return false;
        }
        if (filters.segment && s.segment !== filters.segment) return false;
        if (filters.tag && !s.tags.includes(filters.tag)) return false;
        return true;
      })
      .sort((a, b) => a.rank - b.rank);
  }, [superfans, filters]);

  function openDrawer(s: Superfan) {
    setSelected(s);
    setDrawerOpen(true);
  }

  function exportCsv() {
    push({
      type: 'success',
      title: 'Exportação iniciada',
      description: `${filtered.length} superfãs serão exportados em CSV.`,
    });
  }

  /* ── Columns ──────────────────────────────── */
  const columns: Column<Superfan>[] = [
    {
      id: 'rank',
      header: '#',
      sortKey: (s) => s.rank,
      cell: (s) => (
        <span
          className={cn(
            styles.rankCell,
            s.rank === 1 && styles.rankTop1,
            s.rank === 2 && styles.rankTop2,
            s.rank === 3 && styles.rankTop3
          )}
        >
          {s.rank}
        </span>
      ),
      width: 60,
    },
    {
      id: 'user',
      header: 'Superfã',
      sortKey: (s) => s.user.name,
      cell: (s) => (
        <div className={styles.cellUser}>
          <Avatar name={s.user.name} src={s.user.avatar} size="md" />
          <div className={styles.cellUserText}>
            <span className={styles.cellUserName}>{s.user.name}</span>
            <span className={styles.cellUserMeta}>
              @{s.user.handle} · {s.user.city}-{s.user.state}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'segment',
      header: 'Segmento',
      sortKey: (s) => s.segment,
      cell: (s) => (
        <Badge tone={SEGMENT_TONE[s.segment]} size="sm" dot>
          {SEGMENT_LABEL[s.segment]}
        </Badge>
      ),
      width: 130,
    },
    {
      id: 'fanpoints',
      header: 'Fanpoints',
      sortKey: (s) => s.fanpoints,
      align: 'right',
      cell: (s) => <span className={styles.cellStrong}>{formatNumber(s.fanpoints)}</span>,
      width: 110,
    },
    {
      id: 'spent',
      header: 'Gasto',
      sortKey: (s) => s.totalSpentBRL,
      align: 'right',
      cell: (s) => (
        <span className={s.totalSpentBRL > 0 ? styles.cellStrong : styles.cellMute}>
          {s.totalSpentBRL > 0 ? formatBRL(s.totalSpentBRL) : '—'}
        </span>
      ),
      width: 130,
    },
    {
      id: 'listen',
      header: 'Tempo escuta',
      sortKey: (s) => s.totalListenMinutes,
      align: 'right',
      cell: (s) => <span className={styles.cellMute}>{formatListenTime(s.totalListenMinutes)}</span>,
      width: 130,
    },
    {
      id: 'interactions',
      header: 'Interações',
      sortKey: (s) => s.interactions,
      align: 'right',
      cell: (s) => <span className={styles.cellMute}>{formatNumber(s.interactions)}</span>,
      width: 110,
    },
    {
      id: 'days',
      header: 'Dias ativo',
      sortKey: (s) => s.daysActive,
      align: 'right',
      cell: (s) => <span className={styles.cellMute}>{s.daysActive} d</span>,
      width: 100,
    },
  ];

  return (
    <>
      <PageHeader
        title="Superfãs"
        description="Top 5% mais engajados da plataforma — ranking, segmentação e exportação."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<IconDownload size={14} />}
            onClick={exportCsv}
            disabled={!superfans || filtered.length === 0}
          >
            Exportar CSV
          </Button>
        }
      />

      <div className={styles.body}>
        <div className={styles.kpiGrid}>
          <StatTile
            icon={<IconStar size={14} />}
            value={kpis ? formatNumber(kpis.total) : '—'}
            label="Total de superfãs"
          />
          <StatTile
            icon={<IconHeart size={14} />}
            value={kpis ? formatBRL(kpis.totalRevenue) : '—'}
            label="Receita gerada por superfãs"
          />
          <StatTile
            icon={<IconMusic size={14} />}
            value={
              kpis
                ? `${formatCompact(Math.round(kpis.totalListenMinutes / 60))} h`
                : '—'
            }
            label="Tempo total de escuta"
          />
          <StatTile
            icon={<IconStar size={14} />}
            value={kpis ? `${kpis.avgDays} dias` : '—'}
            label="Tempo médio de plataforma"
          />
        </div>

        <Card>
          <CardHeader
            title="Ranking de superfãs"
            description="Ordenado pela posição no ranking — clique numa linha para ver o detalhe completo."
          />

          <div className={styles.filters}>
            <Input
              inputSize="md"
              placeholder="Buscar por nome ou @handle"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            />
            <Select
              inputSize="md"
              value={filters.segment}
              onChange={(e) => setFilters({ ...filters, segment: e.target.value })}
              options={SEGMENT_OPTIONS}
            />
            <Select
              inputSize="md"
              value={filters.tag}
              onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
              options={[
                { value: '', label: 'Todas as tags' },
                ...allTags.map((t) => ({ value: t, label: t })),
              ]}
            />
          </div>

          <Table<Superfan>
            columns={columns}
            data={filtered}
            rowId={(s) => s.id}
            onRowClick={openDrawer}
            pageSize={12}
            loading={superfans === null}
          />
        </Card>
      </div>

      <SuperfanDetailDrawer
        superfan={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
