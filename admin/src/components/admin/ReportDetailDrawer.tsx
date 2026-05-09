'use client';

import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  IconCheck,
  IconX,
  IconAlert,
  IconTrash,
  IconBan,
  IconShield,
  IconLink,
} from '@/components/icons';
import type { Report, ReportReason } from '@/types';
import { formatDateTime, formatRelative } from '@/lib/format';
import styles from './ReportDetailDrawer.module.css';

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

export interface ReportDetailDrawerProps {
  report: Report | null;
  open: boolean;
  onClose: () => void;
  onResolve: (r: Report) => void;
  onDismiss: (r: Report) => void;
  onEscalate: (r: Report) => void;
  onRemoveContent: (r: Report) => void;
  onBanAuthor: (r: Report) => void;
  onBlockAuthor: (r: Report) => void;
}

export default function ReportDetailDrawer({
  report,
  open,
  onClose,
  onResolve,
  onDismiss,
  onEscalate,
  onRemoveContent,
  onBanAuthor,
  onBlockAuthor,
}: ReportDetailDrawerProps) {
  if (!report) {
    return <Drawer open={open} onClose={onClose}>{null}</Drawer>;
  }

  const targetKind = TARGET_KIND_LABEL[report.target.kind];
  const isFinal =
    report.status === 'resolved' || report.status === 'dismissed';
  const isPost = report.target.kind === 'post';
  const hasAuthor = Boolean(report.targetSnapshot.authorName);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className={styles.headerInner}>
          <Avatar name={report.reporter.name} src={report.reporter.avatar} size="lg" />
          <div className={styles.headerText}>
            <span className={styles.headerName}>{report.reporter.name}</span>
            <span className={styles.headerSub}>
              denunciou {targetKind.toLowerCase() === 'post' ? 'um' : targetKind.toLowerCase() === 'mensagem' ? 'uma' : 'um'}{' '}
              {targetKind.toLowerCase()} · #{report.id}
            </span>
          </div>
        </div>
      }
    >
      {/* ── Resumo da denúncia ─────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Resumo da denúncia</span>
          <span className={styles.sectionDescription}>
            Contexto cadastral da denúncia para decisão rápida.
          </span>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCol}>
            <span className={styles.eyebrow}>Classificação</span>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Motivo</span>
              <span>
                <Badge tone={REASON_TONE[report.reason]} size="md">
                  {REASON_LABEL[report.reason]}
                </Badge>
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Prioridade</span>
              <span>
                <Badge tone={PRIORITY_TONE[report.priority]} size="md" dot>
                  {PRIORITY_LABEL[report.priority]}
                </Badge>
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Status</span>
              <span>
                <StatusBadge status={report.status} />
              </span>
            </div>
          </div>

          <div className={styles.summaryCol}>
            <span className={styles.eyebrow}>Auditoria</span>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Responsável</span>
              <span
                className={`${styles.summaryItemValue} ${!report.assignedTo ? styles.summaryItemMute : ''}`}
              >
                {report.assignedTo?.name ?? 'Não atribuído'}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Aberta em</span>
              <span className={styles.summaryItemValue}>
                {formatDateTime(report.createdAt)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Resolvida em</span>
              <span
                className={`${styles.summaryItemValue} ${!report.resolvedAt ? styles.summaryItemMute : ''}`}
              >
                {report.resolvedAt ? formatDateTime(report.resolvedAt) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.descriptionBox}>
          {report.description ? (
            report.description
          ) : (
            <span className={styles.descriptionEmpty}>
              O denunciante não escreveu uma descrição adicional.
            </span>
          )}
        </div>
      </div>

      {/* ── Alvo da denúncia ───────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Alvo</span>
          <span className={styles.sectionDescription}>
            Conteúdo ou usuário sob investigação nesta denúncia.
          </span>
        </div>

        <div className={styles.targetCard}>
          <div className={styles.targetHead}>
            <span className={styles.targetLabel}>{report.targetSnapshot.label}</span>
            <Badge tone="neutral" size="sm">{targetKind}</Badge>
          </div>

          {report.targetSnapshot.excerpt && (
            <div className={styles.targetExcerpt}>{report.targetSnapshot.excerpt}</div>
          )}

          {report.targetSnapshot.authorName && (
            <div className={styles.targetAuthor}>
              Autor: <b>{report.targetSnapshot.authorName}</b>
            </div>
          )}

          <div className={styles.targetActions}>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<IconLink size={13} />}
              disabled
              title="Disponível quando integrado ao backend"
            >
              Ver no contexto
            </Button>
          </div>
        </div>
      </div>

      {/* ── Ações ────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Ações</span>
          <span className={styles.sectionDescription}>
            Decisão final ou encaminhamento desta denúncia.
          </span>
        </div>

        <div className={styles.actionsGroup}>
          <span className={styles.actionsHeading}>Decisão</span>
          <div className={styles.actionsRow}>
            <Button
              variant="primary"
              size="md"
              leadingIcon={<IconCheck size={14} />}
              onClick={() => onResolve(report)}
              disabled={isFinal}
            >
              Resolver
            </Button>
            <Button
              variant="outline"
              size="md"
              leadingIcon={<IconAlert size={14} />}
              onClick={() => onEscalate(report)}
              disabled={isFinal || report.status === 'escalated'}
            >
              Escalar
            </Button>
            <Button
              variant="ghost"
              size="md"
              leadingIcon={<IconX size={14} />}
              onClick={() => onDismiss(report)}
              disabled={isFinal}
            >
              Dispensar
            </Button>
          </div>

          {isPost && (
            <>
              <div className={styles.actionsDivider} />
              <span className={styles.actionsHeading}>Conteúdo</span>
              <div className={styles.actionsRow2}>
                <Button
                  variant="dangerGhost"
                  size="md"
                  leadingIcon={<IconTrash size={14} />}
                  onClick={() => onRemoveContent(report)}
                  disabled={isFinal}
                >
                  Remover conteúdo
                </Button>
              </div>
            </>
          )}

          {hasAuthor && (
            <>
              <div className={styles.actionsDivider} />
              <span className={styles.actionsHeading}>Autor</span>
              <div className={styles.actionsRow2}>
                <Button
                  variant="outline"
                  size="md"
                  leadingIcon={<IconShield size={14} />}
                  onClick={() => onBlockAuthor(report)}
                >
                  Bloquear autor
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  leadingIcon={<IconBan size={14} />}
                  onClick={() => onBanAuthor(report)}
                >
                  Banir autor
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
