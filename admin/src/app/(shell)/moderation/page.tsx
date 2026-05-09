'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import Table, { type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import StatTile from '@/components/admin/StatTile';
import ReportDetailDrawer from '@/components/admin/ReportDetailDrawer';
import {
  IconShield,
  IconAlert,
  IconCheck,
  IconX,
  IconCheckCircle,
  IconCalendar,
} from '@/components/icons';
import { reportsService } from '@/services/reports';
import { formatNumber, formatRelative } from '@/lib/format';
import type { Report, ReportReason, ReportStatus } from '@/types';

import styles from './page.module.css';

/* ── Helpers / maps ─────────────────────────── */

const REASON_LABEL: Record<ReportReason, string> = {
  spam:           'Spam',
  harassment:     'Assédio',
  hate:           'Discurso de ódio',
  nudity:         'Nudez',
  misinformation: 'Desinformação',
  copyright:      'Direitos autorais',
  other:          'Outros',
};

const REASON_TONE: Record<ReportReason, BadgeTone> = {
  spam:           'info',
  harassment:     'warning',
  hate:           'danger',
  nudity:         'warning',
  misinformation: 'warning',
  copyright:      'neutral',
  other:          'neutral',
};

const PRIORITY_LABEL: Record<Report['priority'], string> = {
  low:    'Baixa',
  medium: 'Média',
  high:   'Alta',
};
const PRIORITY_TONE: Record<Report['priority'], BadgeTone> = {
  low:    'neutral',
  medium: 'info',
  high:   'danger',
};

const TARGET_KIND_LABEL: Record<Report['target']['kind'], string> = {
  post:    'Post',
  user:    'Usuário',
  message: 'Mensagem',
};

const REASON_OPTIONS = [
  { value: '',               label: 'Todos os motivos' },
  { value: 'spam',           label: 'Spam' },
  { value: 'harassment',     label: 'Assédio' },
  { value: 'hate',           label: 'Discurso de ódio' },
  { value: 'nudity',         label: 'Nudez' },
  { value: 'misinformation', label: 'Desinformação' },
  { value: 'copyright',      label: 'Direitos autorais' },
  { value: 'other',          label: 'Outros' },
];
const PRIORITY_OPTIONS = [
  { value: '',       label: 'Todas as prioridades' },
  { value: 'high',   label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low',    label: 'Baixa' },
];
const TARGET_OPTIONS = [
  { value: '',        label: 'Todos os tipos' },
  { value: 'post',    label: 'Post' },
  { value: 'user',    label: 'Usuário' },
  { value: 'message', label: 'Mensagem' },
];

type StatusTab = 'all' | ReportStatus;

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'all',       label: 'Todas' },
  { id: 'open',      label: 'Abertas' },
  { id: 'review',    label: 'Em análise' },
  { id: 'escalated', label: 'Escaladas' },
  { id: 'resolved',  label: 'Resolvidas' },
  { id: 'dismissed', label: 'Dispensadas' },
];

const PRIORITY_WEIGHT: Record<Report['priority'], number> = {
  high: 3, medium: 2, low: 1,
};

type PendingAction =
  | { kind: 'resolve';  report: Report }
  | { kind: 'dismiss';  report: Report }
  | { kind: 'escalate'; report: Report }
  | { kind: 'remove';   report: Report }
  | { kind: 'banAuthor';   report: Report }
  | { kind: 'blockAuthor'; report: Report };

/* ── Page ───────────────────────────────────── */

export default function ModerationPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>('open');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState('');
  const [targetKind, setTargetKind] = useState('');
  const [selected, setSelected] = useState<Report | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const { push } = useToast();

  useEffect(() => {
    reportsService.list().then(setReports);
  }, []);

  /* ── KPIs ─────────────────────────────────── */
  const kpis = useMemo(() => {
    if (!reports) return null;
    const ACTIVE = new Set<ReportStatus>(['open', 'review', 'escalated']);
    const open = reports.filter((r) => ACTIVE.has(r.status));
    const high = reports.filter((r) => r.priority === 'high' && ACTIVE.has(r.status));

    const resolved = reports.filter((r) => r.status === 'resolved' && r.resolvedAt);
    const recentResolved = resolved.filter((r) => {
      const ms = Date.now() - new Date(r.resolvedAt!).getTime();
      return ms < 7 * 86_400_000;
    });

    const avgResolutionMs =
      resolved.length === 0
        ? 0
        : resolved.reduce(
            (acc, r) =>
              acc + (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()),
            0
          ) / resolved.length;
    const avgResolutionDays = avgResolutionMs / 86_400_000;

    return {
      open: open.length,
      high: high.length,
      avgResolutionDays,
      recentResolved: recentResolved.length,
      counts: {
        all:       reports.length,
        open:      reports.filter((r) => r.status === 'open').length,
        review:    reports.filter((r) => r.status === 'review').length,
        escalated: reports.filter((r) => r.status === 'escalated').length,
        resolved:  reports.filter((r) => r.status === 'resolved').length,
        dismissed: reports.filter((r) => r.status === 'dismissed').length,
      },
    };
  }, [reports]);

  /* ── Filtered list ───────────────────────── */
  const filtered = useMemo(() => {
    if (!reports) return [];
    return reports
      .filter((r) => {
        if (statusTab !== 'all' && r.status !== statusTab) return false;
        if (reason && r.reason !== reason) return false;
        if (priority && r.priority !== priority) return false;
        if (targetKind && r.target.kind !== targetKind) return false;
        return true;
      })
      .sort((a, b) => {
        // Active reports: sort by priority desc, then createdAt asc (oldest first)
        // Final reports: sort by createdAt desc (newest first)
        const aActive = a.status === 'open' || a.status === 'review' || a.status === 'escalated';
        const bActive = b.status === 'open' || b.status === 'review' || b.status === 'escalated';
        if (aActive && bActive) {
          const dp = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
          if (dp !== 0) return dp;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [reports, statusTab, reason, priority, targetKind]);

  /* ── Action helpers ──────────────────────── */

  function applyReportStatus(id: string, newStatus: ReportStatus) {
    if (!reports) return;
    const now = new Date().toISOString();
    const next = reports.map((r) =>
      r.id === id
        ? {
            ...r,
            status: newStatus,
            resolvedAt:
              newStatus === 'resolved' || newStatus === 'dismissed'
                ? now
                : r.resolvedAt,
          }
        : r
    );
    setReports(next);
    if (selected?.id === id) {
      const updated = next.find((r) => r.id === id) ?? null;
      setSelected(updated);
    }
  }

  function confirmPending() {
    if (!pending) return;
    const { kind, report } = pending;
    switch (kind) {
      case 'resolve':
        applyReportStatus(report.id, 'resolved');
        push({ type: 'success', title: 'Denúncia resolvida', description: `Caso #${report.id} foi marcado como resolvido.` });
        break;
      case 'dismiss':
        applyReportStatus(report.id, 'dismissed');
        push({ type: 'info', title: 'Denúncia dispensada', description: `Caso #${report.id} foi descartado sem ação.` });
        break;
      case 'escalate':
        applyReportStatus(report.id, 'escalated');
        push({ type: 'warning', title: 'Denúncia escalada', description: 'Encaminhada à equipe sênior de moderação.' });
        break;
      case 'remove':
        applyReportStatus(report.id, 'resolved');
        push({ type: 'error', title: 'Conteúdo removido', description: 'O conteúdo foi removido e a denúncia marcada como resolvida.' });
        break;
      case 'banAuthor':
        applyReportStatus(report.id, 'resolved');
        push({ type: 'error', title: 'Autor banido', description: `${report.targetSnapshot.authorName ?? 'Usuário'} perdeu acesso permanente.` });
        break;
      case 'blockAuthor':
        applyReportStatus(report.id, 'resolved');
        push({ type: 'warning', title: 'Autor bloqueado', description: `${report.targetSnapshot.authorName ?? 'Usuário'} teve acesso suspenso.` });
        break;
    }
    setPending(null);
  }

  function openDrawer(report: Report) {
    setSelected(report);
    setDrawerOpen(true);
  }

  /* ── Table columns ──────────────────────── */
  const columns: Column<Report>[] = [
    {
      id: 'reporter',
      header: 'Denunciante',
      sortKey: (r) => r.reporter.name,
      cell: (r) => (
        <div className={styles.cellReporter}>
          <Avatar name={r.reporter.name} src={r.reporter.avatar} size="md" />
          <div className={styles.cellReporterText}>
            <span className={styles.cellReporterName}>{r.reporter.name}</span>
            <span className={styles.cellReporterHandle}>@{r.reporter.handle}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'target',
      header: 'Alvo',
      sortKey: (r) => r.targetSnapshot.label,
      cell: (r) => (
        <div className={styles.cellTarget}>
          <span className={styles.cellTargetHead}>
            {r.targetSnapshot.label}
            <Badge tone="neutral" size="sm">
              {TARGET_KIND_LABEL[r.target.kind]}
            </Badge>
          </span>
          {r.targetSnapshot.excerpt && (
            <span className={styles.cellTargetExcerpt}>
              {r.targetSnapshot.excerpt}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'reason',
      header: 'Motivo',
      sortKey: (r) => r.reason,
      cell: (r) => (
        <Badge tone={REASON_TONE[r.reason]} size="sm">
          {REASON_LABEL[r.reason]}
        </Badge>
      ),
      width: 160,
    },
    {
      id: 'priority',
      header: 'Prioridade',
      sortKey: (r) => -PRIORITY_WEIGHT[r.priority],
      cell: (r) => (
        <Badge tone={PRIORITY_TONE[r.priority]} size="sm" dot>
          {PRIORITY_LABEL[r.priority]}
        </Badge>
      ),
      width: 110,
    },
    {
      id: 'assignee',
      header: 'Responsável',
      sortKey: (r) => r.assignedTo?.name ?? 'zzz',
      cell: (r) => (
        <span className={styles.cellMute}>
          {r.assignedTo?.name ?? '—'}
        </span>
      ),
      width: 160,
    },
    {
      id: 'when',
      header: 'Quando',
      sortKey: (r) => r.createdAt,
      cell: (r) => (
        <span className={styles.cellWhen}>{formatRelative(r.createdAt)}</span>
      ),
      width: 110,
    },
    {
      id: 'actions',
      header: 'Ação',
      align: 'right',
      cell: (r) => {
        const isFinal = r.status === 'resolved' || r.status === 'dismissed';
        return (
          <div className={styles.cellActions} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              className={styles.resolveBtn}
              aria-label="Resolver"
              title="Resolver"
              onClick={() => setPending({ kind: 'resolve', report: r })}
              disabled={isFinal}
            >
              <IconCheck size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Dispensar"
              title="Dispensar"
              onClick={() => setPending({ kind: 'dismiss', report: r })}
              disabled={isFinal}
            >
              <IconX size={14} />
            </Button>
          </div>
        );
      },
    },
  ];

  /* ── Pending action labels ────────────────── */
  const pendingLabels = pending
    ? (() => {
        const r = pending.report;
        switch (pending.kind) {
          case 'resolve':
            return {
              title: `Resolver denúncia #${r.id}?`,
              description: 'A denúncia será marcada como resolvida e arquivada nos logs.',
              confirm: 'Resolver',
              destructive: false,
            };
          case 'dismiss':
            return {
              title: `Dispensar denúncia #${r.id}?`,
              description: 'A denúncia será descartada sem ação. Você ainda pode auditar nos logs.',
              confirm: 'Dispensar',
              destructive: false,
            };
          case 'escalate':
            return {
              title: `Escalar denúncia #${r.id}?`,
              description: 'A denúncia será enviada à equipe sênior de moderação para revisão.',
              confirm: 'Escalar',
              destructive: false,
            };
          case 'remove':
            return {
              title: 'Remover conteúdo da plataforma?',
              description: 'O conteúdo é apagado da timeline pública. A denúncia é fechada como resolvida.',
              confirm: 'Remover conteúdo',
              destructive: true,
            };
          case 'banAuthor':
            return {
              title: `Banir ${r.targetSnapshot.authorName ?? 'autor'}?`,
              description: 'Acesso permanente revogado. A denúncia é fechada como resolvida.',
              confirm: 'Banir autor',
              destructive: true,
            };
          case 'blockAuthor':
            return {
              title: `Bloquear ${r.targetSnapshot.authorName ?? 'autor'}?`,
              description: 'Acesso suspenso temporariamente. A denúncia é fechada como resolvida.',
              confirm: 'Bloquear autor',
              destructive: false,
            };
        }
      })()
    : null;

  return (
    <>
      <PageHeader
        title="Moderação"
        description="Fila de denúncias e conteúdos sinalizados — triagem, decisão e auditoria das ações."
      />

      <div className={styles.body}>
        <div className={styles.kpiGrid}>
          <StatTile
            icon={<IconShield size={14} />}
            value={kpis ? formatNumber(kpis.open) : '—'}
            label="Denúncias abertas"
          />
          <StatTile
            icon={<IconAlert size={14} />}
            value={kpis ? formatNumber(kpis.high) : '—'}
            label="Alta prioridade pendentes"
          />
          <StatTile
            icon={<IconCalendar size={14} />}
            value={
              kpis
                ? `${kpis.avgResolutionDays.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
                : '—'
            }
            label="Tempo médio de resolução"
          />
          <StatTile
            icon={<IconCheckCircle size={14} />}
            value={kpis ? formatNumber(kpis.recentResolved) : '—'}
            label="Resolvidas (7 dias)"
          />
        </div>

        <Card>
          <CardHeader
            title="Fila de moderação"
            description="Casos ativos no topo, ordenados por prioridade e tempo de espera."
          />

          <div className={styles.tabsRow}>
            <Tabs<StatusTab>
              variant="bordered"
              items={STATUS_TABS.map((t) => ({
                ...t,
                count: kpis ? (t.id === 'all' ? kpis.counts.all : kpis.counts[t.id as ReportStatus]) : undefined,
              }))}
              value={statusTab}
              onChange={setStatusTab}
            />
          </div>

          <div className={styles.filters}>
            <Select
              inputSize="md"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={REASON_OPTIONS}
            />
            <Select
              inputSize="md"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={PRIORITY_OPTIONS}
            />
            <Select
              inputSize="md"
              value={targetKind}
              onChange={(e) => setTargetKind(e.target.value)}
              options={TARGET_OPTIONS}
            />
          </div>

          <Table<Report>
            columns={columns}
            data={filtered}
            rowId={(r) => r.id}
            onRowClick={openDrawer}
            pageSize={10}
            loading={reports === null}
          />
        </Card>
      </div>

      <ReportDetailDrawer
        report={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onResolve={(r) => setPending({ kind: 'resolve', report: r })}
        onDismiss={(r) => setPending({ kind: 'dismiss', report: r })}
        onEscalate={(r) => setPending({ kind: 'escalate', report: r })}
        onRemoveContent={(r) => setPending({ kind: 'remove', report: r })}
        onBanAuthor={(r) => setPending({ kind: 'banAuthor', report: r })}
        onBlockAuthor={(r) => setPending({ kind: 'blockAuthor', report: r })}
      />

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
        title={pendingLabels?.title ?? ''}
        description={pendingLabels?.description}
        confirmLabel={pendingLabels?.confirm ?? 'Confirmar'}
        destructive={pendingLabels?.destructive}
      />
    </>
  );
}
