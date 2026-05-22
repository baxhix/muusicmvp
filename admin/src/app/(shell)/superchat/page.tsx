'use client';

import { useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table, { type Column } from '@/components/ui/Table';
import {
  IconSearch,
  IconMessage,
  IconUsers,
  IconShield,
} from '@/components/icons';
import {
  loadSuperchatRooms,
  SUPERCHAT_STATUS_LABEL,
  SUPERCHAT_KIND_LABEL,
  type SuperchatRoom,
  type SuperchatRoomStatus,
} from '@/data/mock/superchat';
import { formatNumber, formatRelative } from '@/lib/format';
import styles from './page.module.css';

/**
 * Superchat — listagem das salas de chat coletivo.
 *
 * Cobertura inicial (stub mais detalhe vem do produto):
 * acompanhar quais salas estão ativas, quantas pessoas, quanto
 * de movimento (mensagens recentes), e qual o vínculo (global,
 * live event, comunidade).
 *
 * Quando o backend de moderação subir, mais ações entram (banir,
 * pinning, fechar sala). Por enquanto: listagem read-only no
 * mesmo template do Pre Save / Live.
 */

const STATUS_TONE: Record<SuperchatRoomStatus, BadgeTone> = {
  active: 'success',
  idle:   'info',
  closed: 'neutral',
};

const STATUS_OPTIONS = [
  { value: 'all',    label: 'Todos os status' },
  { value: 'active', label: 'Ativas' },
  { value: 'idle',   label: 'Ociosas' },
  { value: 'closed', label: 'Fechadas' },
];

export default function SuperchatPage() {
  const [rows] = useState<SuperchatRoom[]>(() => loadSuperchatRooms());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SuperchatRoomStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, status]);

  const summary = useMemo(() => {
    const active = rows.filter((r) => r.status === 'active').length;
    const totalParticipants = rows
      .filter((r) => r.status !== 'closed')
      .reduce((sum, r) => sum + r.participants, 0);
    const totalRecentMsgs = rows.reduce(
      (sum, r) => sum + r.recentMessages,
      0,
    );
    return { active, totalParticipants, totalRecentMsgs, total: rows.length };
  }, [rows]);

  const columns: Column<SuperchatRoom>[] = [
    {
      id: 'name',
      header: 'Sala',
      sortKey: (r) => r.name,
      cell: (r) => (
        <div className={styles.cellName}>
          <span className={styles.roomName}>{r.name}</span>
          <span className={styles.roomMeta}>{SUPERCHAT_KIND_LABEL[r.kind]}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (r) => r.status,
      cell: (r) => (
        <Badge tone={STATUS_TONE[r.status]} size="sm" dot>
          {SUPERCHAT_STATUS_LABEL[r.status]}
        </Badge>
      ),
      width: 110,
    },
    {
      id: 'participants',
      header: 'Participantes',
      sortKey: (r) => r.participants,
      align: 'right',
      cell: (r) => (
        <span className={styles.numCell}>{formatNumber(r.participants)}</span>
      ),
      width: 130,
    },
    {
      id: 'recentMessages',
      header: 'Msgs (5min)',
      sortKey: (r) => r.recentMessages,
      align: 'right',
      cell: (r) => (
        <span className={styles.numCell}>{formatNumber(r.recentMessages)}</span>
      ),
      width: 120,
    },
    {
      id: 'lastActivity',
      header: 'Última atividade',
      sortKey: (r) => r.lastActivityAt ?? '',
      cell: (r) => (
        <span className={styles.muteCell}>
          {r.lastActivityAt ? formatRelative(r.lastActivityAt) : '—'}
        </span>
      ),
      width: 150,
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Superchat"
        description="Salas de chat coletivo do Fanverse: superchat global, chats das lives e comunidades dedicadas. Acompanhe atividade em tempo real."
      />

      {/* ── KPIs ───────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Salas totais"
          value={String(summary.total)}
          icon={<IconMessage size={14} />}
          trendLabel={`${summary.active} ativas agora`}
        />
        <StatCard
          label="Participantes online"
          value={formatNumber(summary.totalParticipants)}
          icon={<IconUsers size={14} />}
          trendLabel="Soma das salas ativas + ociosas"
        />
        <StatCard
          label="Mensagens (últ. 5min)"
          value={formatNumber(summary.totalRecentMsgs)}
          icon={<IconMessage size={14} />}
          trendLabel="Heurística de atividade ao vivo"
        />
        <StatCard
          label="Moderação"
          value="Em breve"
          icon={<IconShield size={14} />}
          trendLabel="Banir, fixar e fechar salas"
        />
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <Card className={styles.filters}>
        <Input
          inputSize="md"
          placeholder="Buscar por sala…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <Select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as SuperchatRoomStatus | 'all')
          }
          options={STATUS_OPTIONS}
        />
      </Card>

      {/* ── Tabela ─────────────────────────────────────── */}
      <Card className={styles.tableCard}>
        <Table<SuperchatRoom>
          columns={columns}
          data={filtered}
          rowId={(r) => r.id}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
