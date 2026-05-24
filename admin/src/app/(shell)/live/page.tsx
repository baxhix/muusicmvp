'use client';

import { useEffect, useMemo, useState } from 'react';
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
  IconUsers,
  IconMessage,
  IconVideo,
} from '@/components/icons';
import {
  liveService,
  LIVE_STATUS_LABEL as STATUS_LABEL,
  LIVE_AUDIENCE_LABEL as AUDIENCE_LABEL,
  type LiveEvent,
  type LiveStatus,
} from '@/services/live';
import { formatNumber, formatRelative } from '@/lib/format';
import styles from './page.module.css';

/**
 * Live — admin page pra gestão de eventos ao vivo.
 *
 * Modelo (per product feedback): backoffice agenda um evento com
 * data, decide se o chat fica liberado, escolhe a audience tier
 * (Top 1/10/50/100/todos). No horário, a artista (ou equipe) usa
 * o app de creator e dá start na transmissão.
 *
 * Estado atual: dados mockados em `data/mock/live.ts`. Quando o
 * backend correspondente subir, troca-se `loadLiveEvents()` por
 * um fetch — o shape e os renderers desta página não dependem
 * da fonte.
 */

const STATUS_TONE: Record<LiveStatus, BadgeTone> = {
  scheduled: 'info',
  live:      'success',
  ended:     'neutral',
  cancelled: 'warning',
};

const STATUS_OPTIONS = [
  { value: 'all',       label: 'Todos os status' },
  { value: 'scheduled', label: 'Agendadas' },
  { value: 'live',      label: 'Ao vivo' },
  { value: 'ended',     label: 'Encerradas' },
  { value: 'cancelled', label: 'Canceladas' },
];

/** Formata "21/05 · 21:00" — uma linha, leitura rápida. */
function formatLiveDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LivePage() {
  const [rows, setRows] = useState<LiveEvent[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LiveStatus | 'all'>('all');

  useEffect(() => {
    liveService.list().then(setRows).catch((err) => {
      console.error('liveService.list failed:', err);
      setRows([]);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (q) {
        const hay = `${r.name} ${r.artist}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status]);

  const summary = useMemo(() => {
    const total = rows.length;
    const live = rows.filter((r) => r.status === 'live').length;
    const scheduled = rows.filter((r) => r.status === 'scheduled').length;
    const totalViewers = rows.reduce((sum, r) => sum + r.viewersPeak, 0);
    return { total, live, scheduled, totalViewers };
  }, [rows]);

  const columns: Column<LiveEvent>[] = [
    {
      id: 'name',
      header: 'Evento',
      sortKey: (e) => e.name,
      cell: (e) => (
        <div className={styles.cellName}>
          <span className={styles.eventName}>{e.name}</span>
          <span className={styles.eventMeta}>{e.artist}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (e) => e.status,
      cell: (e) => (
        <Badge tone={STATUS_TONE[e.status]} size="sm" dot>
          {STATUS_LABEL[e.status]}
        </Badge>
      ),
      width: 110,
    },
    {
      id: 'scheduledAt',
      header: 'Data',
      sortKey: (e) => e.scheduledAt,
      cell: (e) => (
        <span className={styles.muteCell}>
          {formatLiveDateTime(e.scheduledAt)}
        </span>
      ),
      width: 140,
    },
    {
      id: 'audience',
      header: 'Audiência',
      sortKey: (e) => e.audience,
      cell: (e) => (
        <span className={styles.audienceChip}>{AUDIENCE_LABEL[e.audience]}</span>
      ),
      width: 110,
    },
    {
      id: 'chat',
      header: 'Chat',
      sortKey: (e) => (e.chatEnabled ? 1 : 0),
      cell: (e) => (
        <span
          className={`${styles.chatChip} ${
            e.chatEnabled ? styles.chatChipOn : styles.chatChipOff
          }`}
        >
          {e.chatEnabled ? 'Aberto' : 'Fechado'}
        </span>
      ),
      width: 100,
    },
    {
      id: 'viewersPeak',
      header: 'Pico de audiência',
      sortKey: (e) => e.viewersPeak,
      align: 'right',
      cell: (e) => (
        <span className={styles.numCell}>
          {e.status === 'scheduled' || e.status === 'cancelled'
            ? '—'
            : formatNumber(e.viewersPeak)}
        </span>
      ),
      width: 140,
    },
    {
      id: 'createdAt',
      header: 'Criada',
      sortKey: (e) => e.createdAt,
      cell: (e) => (
        <span className={styles.muteCell}>{formatRelative(e.createdAt)}</span>
      ),
      width: 130,
    },
  ];

  return (
    <>
      <PageHeader
        title="Live"
        description="Eventos ao vivo agendados pelo backoffice. Defina data, libere o chat (Superchat) e escolha quais fãs serão notificados e poderão entrar."
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            disabled
            title="Criação de eventos será habilitada quando o app de creator estiver integrado."
          >
            Nova live
          </Button>
        }
      />

      <div className={styles.body}>
      {/* ── KPIs ───────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Eventos totais"
          value={String(summary.total)}
          icon={<IconCalendar size={14} />}
          trendLabel={`${summary.scheduled} agendadas`}
        />
        <StatCard
          label="Ao vivo agora"
          value={String(summary.live)}
          icon={<IconVideo size={14} />}
          trendLabel="Transmitindo neste momento"
        />
        <StatCard
          label="Próximas (próx. 30 dias)"
          value={String(summary.scheduled)}
          icon={<IconCheck size={14} />}
          trendLabel="Já anunciadas pra audiência"
        />
        <StatCard
          label="Pico acumulado"
          value={formatNumber(summary.totalViewers)}
          icon={<IconUsers size={14} />}
          trendLabel="Soma dos picos de cada evento"
        />
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <Card className={styles.filters}>
        <Input
          inputSize="md"
          placeholder="Buscar por evento ou artista…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as LiveStatus | 'all')}
          options={STATUS_OPTIONS}
        />
      </Card>

      {/* ── Tabela ─────────────────────────────────────── */}
      <Card className={styles.tableCard}>
        <Table<LiveEvent>
          columns={columns}
          data={filtered}
          rowId={(e) => e.id}
          pageSize={10}
        />
      </Card>

      {/* ── Hint operacional ─────────────────────────── */}
      <Card className={styles.hintCard}>
        <div className={styles.hintBody}>
          <IconMessage size={16} />
          <div>
            <div className={styles.hintTitle}>
              Como o chat (Superchat) funciona aqui
            </div>
            <p className={styles.hintText}>
              Quando o evento tem <strong>Chat: Aberto</strong>, a audiência
              definida acima pode mandar mensagens em tempo real durante a
              transmissão. A sala vira uma entrada em <em>Superchat</em>{' '}
              automaticamente assim que a live entrar no ar.
            </p>
          </div>
        </div>
      </Card>
      </div>
    </>
  );
}
