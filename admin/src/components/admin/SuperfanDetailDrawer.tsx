'use client';

import Drawer from '@/components/ui/Drawer';
import Avatar from '@/components/ui/Avatar';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import { IconStar } from '@/components/icons';
import type { Superfan } from '@/types';
import { formatBRL, formatCompact, formatDate, formatNumber } from '@/lib/format';
import styles from './SuperfanDetailDrawer.module.css';

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

function formatListenTime(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${formatCompact(hours)} h`;
  }
  return `${minutes} min`;
}

export interface SuperfanDetailDrawerProps {
  superfan: Superfan | null;
  open: boolean;
  onClose: () => void;
}

export default function SuperfanDetailDrawer({
  superfan,
  open,
  onClose,
}: SuperfanDetailDrawerProps) {
  if (!superfan) {
    return <Drawer open={open} onClose={onClose}>{null}</Drawer>;
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div className={styles.headerInner}>
          <Avatar name={superfan.user.name} src={superfan.user.avatar} size="lg" />
          <div className={styles.headerText}>
            <span className={styles.headerName}>{superfan.user.name}</span>
            <span className={styles.headerSub}>
              @{superfan.user.handle} · {superfan.user.city}-{superfan.user.state}
            </span>
          </div>
          <span className={styles.rankBadge}>
            <IconStar size={12} strokeWidth={2.5} />#{superfan.rank}
          </span>
        </div>
      }
    >
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Métricas</span>
          <span className={styles.sectionDescription}>
            Visão consolidada do engajamento e contribuição financeira.
          </span>
        </div>

        <div className={styles.metricsGrid}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Fanpoints</span>
            <span className={styles.metricValue}>
              {formatNumber(superfan.fanpoints)}
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Gasto total</span>
            <span className={styles.metricValue}>
              {formatBRL(superfan.totalSpentBRL)}
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Tempo de escuta</span>
            <span className={styles.metricValue}>
              {formatListenTime(superfan.totalListenMinutes)}
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Interações</span>
            <span className={styles.metricValue}>
              {formatNumber(superfan.interactions)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Segmentação</span>
          <span className={styles.sectionDescription}>
            Categoria atribuída pela plataforma e tags operacionais.
          </span>
        </div>

        <div className={styles.tags}>
          <Badge tone={SEGMENT_TONE[superfan.segment]} size="md" dot>
            {SEGMENT_LABEL[superfan.segment]}
          </Badge>
          {superfan.tags.map((t) => (
            <Badge key={t} tone="neutral" size="md">
              {t}
            </Badge>
          ))}
          {superfan.tags.length === 0 && (
            <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
              Sem tags adicionais.
            </span>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Auditoria</span>
        </div>

        <div className={styles.audit}>
          <div className={styles.auditRow}>
            <span className={styles.auditLabel}>Entrou na plataforma</span>
            <span className={styles.auditValue}>{formatDate(superfan.joinedAt)}</span>
          </div>
          <div className={styles.auditRow}>
            <span className={styles.auditLabel}>Dias ativo</span>
            <span className={styles.auditValue}>{superfan.daysActive} dias</span>
          </div>
          <div className={styles.auditRow}>
            <span className={styles.auditLabel}>Posição no ranking</span>
            <span className={styles.auditValue}>#{superfan.rank}</span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
