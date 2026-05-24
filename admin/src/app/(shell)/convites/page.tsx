'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table, { type Column } from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  IconPlus,
  IconSearch,
  IconTicket,
  IconUsers,
  IconCheck,
  IconLink,
  IconTrash,
} from '@/components/icons';
import {
  invitesService,
  formatInviteCode,
  summarizeInvites,
} from '@/services/invites';
import { formatDateTime, formatPercent, formatRelative } from '@/lib/format';
import type { InviteCode, InviteStatus } from '@/types';
import styles from './page.module.css';

/**
 * Convites — admin tab for invite-code management.
 *
 * Product model: the auth flow on the public app accepts 6-char
 * alphanumeric codes (A-Z + 2-9, ambiguous chars stripped). The
 * team mints seed codes; each redemption automatically grants the
 * new user 4 fresh codes, creating a viral loop. This page is the
 * CMS that lists every code, who minted it, who redeemed it, and
 * the tree it's part of.
 *
 * Phase 1 (this release): mock data only — generating codes mints
 * client-side rows, no backend persistence. The shape of
 * InviteCode + the page renderer are agnostic, so when the real
 * /api/admin/invites lands the page swap is one fetch call.
 */

const STATUS_LABEL: Record<InviteStatus, string> = {
  pending: 'Pendente',
  used:    'Resgatado',
  expired: 'Expirado',
  revoked: 'Revogado',
};

const STATUS_TONE: Record<InviteStatus, BadgeTone> = {
  pending: 'info',
  used:    'success',
  expired: 'neutral',
  revoked: 'warning',
};

const STATUS_OPTIONS = [
  { value: 'all',     label: 'Todos os status' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'used',    label: 'Resgatados' },
  { value: 'expired', label: 'Expirados' },
  { value: 'revoked', label: 'Revogados' },
];

const SOURCE_OPTIONS = [
  { value: 'all',   label: 'Toda origem' },
  { value: 'admin', label: 'Gerado pelo time' },
  { value: 'user',  label: 'Ganho por convite' },
];

export default function ConvitesPage() {
  const { push } = useToast();

  // Initial dataset is deterministic from the mock generator. New
  // codes minted via the "Gerar" button are prepended client-side
  // — they live only in component state until refresh.
  const [rows, setRows] = useState<InviteCode[]>([]);
  useEffect(() => {
    invitesService.list().then(setRows).catch((err) => {
      console.error('invitesService.list failed:', err);
      setRows([]);
    });
  }, []);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InviteStatus | 'all'>('all');
  const [source, setSource] = useState<'admin' | 'user' | 'all'>('all');
  const [batchSize, setBatchSize] = useState<number>(5);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase().replace(/-/g, '');
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (source !== 'all' && r.createdBy.source !== source) return false;
      if (q) {
        const haystack = [
          r.code,
          r.note,
          r.createdBy.name,
          r.createdBy.email,
          r.usedBy?.name,
          r.usedBy?.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toUpperCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status, source]);

  const summary = useMemo(() => summarizeInvites(rows), [rows]);

  /* ── Actions (mock only) ────────────────────────────── */

  const mintBatch = () => {
    const n = Math.min(Math.max(batchSize, 1), 50);
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const fresh: InviteCode[] = Array.from({ length: n }).map((_, i) => {
      let code = '';
      for (let k = 0; k < 6; k++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      return {
        id: `inv-fresh-${now.toString(36)}-${i}`,
        code,
        status: 'pending',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 60 * day).toISOString(),
        createdBy: {
          id: 'admin-current',
          name: 'Você (admin)',
          email: 'admin@muusic.com.br',
          source: 'admin',
        },
        usedAt: null,
        usedBy: null,
        childCodeIds: [],
        parentCodeId: null,
      };
    });
    setRows((prev) => [...fresh, ...prev]);
    push({
      type: 'success',
      title: `${n} código${n > 1 ? 's' : ''} gerado${n > 1 ? 's' : ''}`,
      description: 'Os códigos estão prontos para serem distribuídos no fluxo de cadastro.',
    });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      push({ type: 'success', title: 'Código copiado', description: code });
    } catch {
      push({ type: 'error', title: 'Não foi possível copiar' });
    }
  };

  const revoke = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'revoked' as InviteStatus } : r)),
    );
    push({ type: 'success', title: 'Código revogado' });
  };

  /* ── Columns ───────────────────────────────────────── */

  const columns: Column<InviteCode>[] = [
    {
      id: 'code',
      header: 'Código',
      cell: (r) => (
        <div className={styles.cellCode}>
          <code className={styles.code}>{formatInviteCode(r.code)}</code>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => copyCode(r.code)}
            aria-label="Copiar código"
            title="Copiar para clipboard"
          >
            <IconLink size={11} />
          </button>
          {r.note && <span className={styles.noteChip}>{r.note}</span>}
        </div>
      ),
      width: 260,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={STATUS_TONE[r.status]} size="sm" dot={r.status === 'pending'}>
          {STATUS_LABEL[r.status]}
        </Badge>
      ),
      width: 130,
    },
    {
      id: 'origin',
      header: 'Gerado por',
      cell: (r) => (
        <div className={styles.cellPerson}>
          <Avatar
            name={r.createdBy.name}
            src={r.createdBy.avatar}
            size="sm"
          />
          <div className={styles.personText}>
            <span className={styles.personName}>{r.createdBy.name}</span>
            <span className={styles.personMeta}>
              {r.createdBy.source === 'admin' ? 'Time interno' : 'Ganhou por convite'}
              {' · '}
              {formatRelative(r.createdAt)}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'used',
      header: 'Resgatado por',
      cell: (r) =>
        r.usedBy && r.usedAt ? (
          <div className={styles.cellPerson}>
            <Avatar name={r.usedBy.name} src={r.usedBy.avatar} size="sm" />
            <div className={styles.personText}>
              <span className={styles.personName}>{r.usedBy.name}</span>
              <span className={styles.personMeta}>
                {formatDateTime(r.usedAt)}
              </span>
            </div>
          </div>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    {
      id: 'tree',
      header: 'Loop viral',
      cell: (r) => {
        const generated = r.childCodeIds.length;
        return (
          <span className={styles.treeCell}>
            {generated > 0 ? (
              <>
                <strong>{generated}</strong> gerado{generated > 1 ? 's' : ''}
              </>
            ) : r.parentCodeId ? (
              <span className={styles.parentRef} title={`Filho de ${r.parentCodeId}`}>
                ↳ filho
              </span>
            ) : (
              <span className={styles.muted}>—</span>
            )}
          </span>
        );
      },
      width: 140,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className={styles.rowActions}>
          {r.status === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => revoke(r.id)}
              leadingIcon={<IconTrash size={12} />}
            >
              Revogar
            </Button>
          )}
        </div>
      ),
      width: 110,
    },
  ];

  return (
    <>
      <PageHeader
        title="Convites"
        description="Códigos de 6 caracteres que abrem o cadastro no app. Cada resgate gera 4 novos códigos para o convidado distribuir."
        actions={
          <div className={styles.headerActions}>
            <Input
              inputSize="sm"
              type="number"
              min={1}
              max={50}
              value={String(batchSize)}
              onChange={(e) => setBatchSize(Number(e.target.value) || 1)}
              className={styles.batchInput}
              aria-label="Quantidade de códigos"
            />
            <Button
              variant="primary"
              size="md"
              leadingIcon={<IconPlus size={14} />}
              onClick={mintBatch}
            >
              Gerar códigos
            </Button>
          </div>
        }
      />

      <div className={styles.body}>
      {/* ── KPIs ───────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Códigos totais"
          value={String(summary.total)}
          icon={<IconTicket size={14} />}
          trendLabel={`${summary.pending} pendentes`}
        />
        <StatCard
          label="Resgatados"
          value={String(summary.used)}
          icon={<IconCheck size={14} />}
          trendLabel={`Taxa de conversão ${formatPercent(summary.conversionRate)}`}
        />
        <StatCard
          label="Novos usuários via convite"
          value={String(summary.uniqueRedeemers)}
          icon={<IconUsers size={14} />}
          trendLabel="Identidades únicas resgatadas"
        />
        <StatCard
          label="Profundidade média"
          value={summary.averageDepth.toFixed(2)}
          icon={<IconLink size={14} />}
          trendLabel="Níveis até a raiz do convite"
        />
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <Card className={styles.filters}>
        <Input
          inputSize="md"
          placeholder="Buscar por código, autor ou resgate…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as InviteStatus | 'all')}
          options={STATUS_OPTIONS}
        />
        <Select
          value={source}
          onChange={(e) => setSource(e.target.value as 'admin' | 'user' | 'all')}
          options={SOURCE_OPTIONS}
        />
      </Card>

      {/* ── Table ──────────────────────────────────────── */}
      <Card className={styles.tableCard}>
        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhum código encontrado"
            description="Limpe os filtros ou gere um lote novo no botão acima."
            actions={
              <Button
                variant="primary"
                size="md"
                leadingIcon={<IconPlus size={14} />}
                onClick={mintBatch}
              >
                Gerar códigos
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={filtered}
            rowId={(r) => r.id}
            pageSize={25}
          />
        )}
      </Card>
      </div>
    </>
  );
}
