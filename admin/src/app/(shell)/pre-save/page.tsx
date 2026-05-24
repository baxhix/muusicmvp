'use client';

import { useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table, { type Column } from '@/components/ui/Table';
import {
  IconPlus,
  IconSearch,
  IconCalendar,
  IconCheck,
  IconHeart,
} from '@/components/icons';
import {
  loadPreSaveCampaigns,
  PLATFORM_LABEL,
  STATUS_LABEL,
  type PreSaveCampaign,
  type PreSaveStatus,
} from '@/data/mock/preSave';
import { formatDate, formatNumber, formatRelative } from '@/lib/format';
import styles from './page.module.css';

/**
 * Pre Save — admin tab para campanhas de pre-save.
 *
 * Estado atual: dados mockados em `data/mock/preSave.ts`. Quando o
 * backend correspondente cair, troca-se `loadPreSaveCampaigns()` por
 * um fetch — o shape do tipo + os renderers desta página são
 * agnósticos.
 */

const STATUS_TONE: Record<PreSaveStatus, BadgeTone> = {
  scheduled: 'info',
  live:      'success',
  released:  'neutral',
  archived:  'warning',
};

const STATUS_OPTIONS = [
  { value: 'all',       label: 'Todos os status' },
  { value: 'scheduled', label: 'Agendadas' },
  { value: 'live',      label: 'Ativas' },
  { value: 'released',  label: 'Encerradas' },
  { value: 'archived',  label: 'Arquivadas' },
];

export default function PreSavePage() {
  const [rows] = useState<PreSaveCampaign[]>(() => loadPreSaveCampaigns());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PreSaveStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (q) {
        const hay = `${r.name} ${r.trackTitle} ${r.artist}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status]);

  const summary = useMemo(() => {
    const total = rows.length;
    const live = rows.filter((r) => r.status === 'live').length;
    const scheduled = rows.filter((r) => r.status === 'scheduled').length;
    const totalSaves = rows.reduce((sum, r) => sum + r.preSavesCount, 0);
    const topCampaign = [...rows].sort((a, b) => b.preSavesCount - a.preSavesCount)[0];
    return { total, live, scheduled, totalSaves, topCampaign };
  }, [rows]);

  const columns: Column<PreSaveCampaign>[] = [
    {
      id: 'name',
      header: 'Campanha',
      sortKey: (c) => c.name,
      cell: (c) => (
        <div className={styles.cellName}>
          <span className={styles.campaignName}>{c.name}</span>
          <span className={styles.trackMeta}>
            {c.trackTitle} · {c.artist}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (c) => c.status,
      cell: (c) => (
        <Badge tone={STATUS_TONE[c.status]} size="sm" dot>
          {STATUS_LABEL[c.status]}
        </Badge>
      ),
      width: 110,
    },
    {
      id: 'releaseDate',
      header: 'Release',
      sortKey: (c) => c.releaseDate,
      cell: (c) => <span className={styles.muteCell}>{formatDate(c.releaseDate)}</span>,
      width: 130,
    },
    {
      id: 'preSavesCount',
      header: 'Pre-saves',
      sortKey: (c) => c.preSavesCount,
      align: 'right',
      cell: (c) => (
        <span className={styles.numCell}>{formatNumber(c.preSavesCount)}</span>
      ),
      width: 110,
    },
    {
      id: 'platforms',
      header: 'Plataformas',
      cell: (c) => (
        <div className={styles.platformChips}>
          {c.platforms.map((p) => (
            <span key={p} className={styles.platformChip}>
              {PLATFORM_LABEL[p]}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: 'createdAt',
      header: 'Criada',
      sortKey: (c) => c.createdAt,
      cell: (c) => (
        <span className={styles.muteCell}>{formatRelative(c.createdAt)}</span>
      ),
      width: 130,
    },
  ];

  return (
    <>
      <PageHeader
        title="Pre Save"
        description="Campanhas de pre-save: usuários salvam a faixa antes do release e recebem o drop automaticamente."
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            disabled
            title="Criação de campanha indisponível até a integração com o catálogo de releases ser ligada."
          >
            Nova campanha
          </Button>
        }
      />

      <div className={styles.body}>
      {/* ── KPIs ───────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Campanhas totais"
          value={String(summary.total)}
          icon={<IconCalendar size={14} />}
          trendLabel={`${summary.scheduled} agendadas`}
        />
        <StatCard
          label="Ativas agora"
          value={String(summary.live)}
          icon={<IconCheck size={14} />}
          trendLabel="Pós-release ainda recebendo saves"
        />
        <StatCard
          label="Pre-saves acumulados"
          value={formatNumber(summary.totalSaves)}
          icon={<IconHeart size={14} />}
          trendLabel="Somatório de todas as campanhas"
        />
        <StatCard
          label="Melhor campanha"
          value={
            summary.topCampaign
              ? formatNumber(summary.topCampaign.preSavesCount)
              : '—'
          }
          trendLabel={summary.topCampaign?.trackTitle ?? 'Sem dados'}
        />
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <Card className={styles.filters}>
        <Input
          inputSize="md"
          placeholder="Buscar por campanha, faixa ou artista…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as PreSaveStatus | 'all')}
          options={STATUS_OPTIONS}
        />
      </Card>

      {/* ── Tabela ─────────────────────────────────────── */}
      <Card className={styles.tableCard}>
        <Table<PreSaveCampaign>
          columns={columns}
          data={filtered}
          rowId={(c) => c.id}
          pageSize={10}
        />
      </Card>
      </div>
    </>
  );
}
