'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Table, { type Column } from '@/components/ui/Table';
import { emailsService, type EmailLog } from '@/services/emails';
import styles from './LogsTab.module.css';

const STATUS_OPTIONS = [
  { value: '',       label: 'Todos os status' },
  { value: 'sent',   label: 'Sucesso' },
  { value: 'failed', label: 'Falha' },
];

const KIND_OPTIONS = [
  { value: '',             label: 'Todos os tipos' },
  { value: 'magic_link',   label: 'Magic link' },
  { value: 'campaign',     label: 'Campanha' },
  { value: 'manual_test',  label: 'Teste manual' },
  { value: 'welcome',      label: 'Boas-vindas' },
];

const SINCE_OPTIONS = [
  { value: '1',   label: 'Últimas 24h' },
  { value: '7',   label: 'Últimos 7 dias' },
  { value: '30',  label: 'Últimos 30 dias' },
  { value: '90',  label: 'Últimos 90 dias' },
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Histórico paginado de TODOS os envios.
 *
 * Filtros: tipo (kind), status (sent/failed), janela temporal,
 * substring no destinatário. Erro de envio aparece inline na
 * linha (truncado). Sem expand/collapse — todos os campos
 * visíveis na própria linha pra leitura rápida pelo operador.
 */
export default function LogsTab() {
  const [logs, setLogs] = useState<EmailLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    kind: '',
    status: '' as '' | 'sent' | 'failed',
    toContains: '',
    sinceDays: '7',
  });

  useEffect(() => {
    let cancel = false;
    setLogs(null);
    emailsService.logs
      .list({
        limit: 200,
        kind: filters.kind || undefined,
        status: filters.status || undefined,
        toContains: filters.toContains || undefined,
        sinceDays: Number(filters.sinceDays) || undefined,
      })
      .then((res) => {
        if (!cancel) setLogs(res.items);
      })
      .catch((err: unknown) => {
        if (cancel) return;
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      });
    return () => {
      cancel = true;
    };
  }, [filters]);

  const columns: Column<EmailLog>[] = useMemo(
    () => [
      {
        id: 'sentAt',
        header: 'Quando',
        sortKey: (r) => r.sentAt,
        cell: (r) => (
          <span className={styles.timeCell}>{formatTime(r.sentAt)}</span>
        ),
        width: 130,
      },
      {
        id: 'to',
        header: 'Destinatário',
        sortKey: (r) => r.to,
        cell: (r) => <span className={styles.toCell}>{r.to}</span>,
      },
      {
        id: 'kind',
        header: 'Tipo',
        sortKey: (r) => r.kind,
        cell: (r) => <Badge tone="neutral" size="sm">{r.kind}</Badge>,
        width: 140,
      },
      {
        id: 'subject',
        header: 'Assunto',
        sortKey: (r) => r.subject,
        cell: (r) => <span className={styles.subjectCell}>{r.subject}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        sortKey: (r) => r.status,
        cell: (r) =>
          r.status === 'sent' ? (
            <Badge tone="success" size="sm" dot>Enviado</Badge>
          ) : (
            <Badge tone="danger" size="sm" dot>Falha</Badge>
          ),
        width: 110,
      },
      {
        id: 'duration',
        header: 'Latência',
        sortKey: (r) => r.durationMs ?? 0,
        cell: (r) => (
          <span className={styles.durationCell}>
            {r.durationMs !== null ? `${r.durationMs} ms` : '—'}
          </span>
        ),
        width: 90,
      },
      {
        id: 'error',
        header: 'Erro',
        cell: (r) =>
          r.errorMessage ? (
            <span className={styles.errorCell} title={r.errorMessage}>
              {r.errorMessage}
            </span>
          ) : (
            <span style={{ color: 'var(--text-faint)' }}>—</span>
          ),
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader
        title="Histórico de envios"
        description="Audit trail do que saiu pelo Resend — sucesso e falhas. Útil pra debugar entrega + investigar reclamações de 'não chegou'."
      />

      <div className={styles.filters}>
        <Input
          inputSize="md"
          placeholder="Buscar por destinatário"
          value={filters.toContains}
          onChange={(e) => setFilters((p) => ({ ...p, toContains: e.target.value }))}
        />
        <Select
          inputSize="md"
          value={filters.kind}
          onChange={(e) => setFilters((p) => ({ ...p, kind: e.target.value }))}
          options={KIND_OPTIONS}
        />
        <Select
          inputSize="md"
          value={filters.status}
          onChange={(e) =>
            setFilters((p) => ({ ...p, status: e.target.value as typeof p.status }))
          }
          options={STATUS_OPTIONS}
        />
        <Select
          inputSize="md"
          value={filters.sinceDays}
          onChange={(e) => setFilters((p) => ({ ...p, sinceDays: e.target.value }))}
          options={SINCE_OPTIONS}
        />
      </div>

      {error && (
        <div className={styles.errorBanner}>Erro ao carregar: {error}</div>
      )}

      <Table<EmailLog>
        columns={columns}
        data={logs ?? []}
        rowId={(r) => r.id}
        pageSize={20}
        loading={logs === null}
      />
    </Card>
  );
}
