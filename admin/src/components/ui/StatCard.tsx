import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@/components/icons';
import styles from './StatCard.module.css';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /**
   * Optional secondary value rendered ao lado do principal — usado
   * pra proporções (ex.: "75%" de "Usuários ativos") onde o número
   * não é uma variação temporal e portanto `trend` (que vem com
   * seta + cor de up/down) não cabe semanticamente. Vai muted +
   * menor pra não competir com o número grande.
   */
  secondary?: ReactNode;
  /** trend value as a number (e.g., 0.124 = +12.4%); pass null for "no comparison" */
  trend?: number | null;
  trendLabel?: string;
  /** numeric series for an inline sparkline */
  spark?: number[];
  /**
   * When true, renders a slow-pulsing green presence dot next to the
   * value. Used for the "Online agora" tile to telegraph that the
   * number is live and reflects the platform's current state.
   */
  live?: boolean;
  className?: string;
}

function formatPct(n: number): string {
  const v = n * 100;
  const abs = Math.abs(v);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${abs.toFixed(abs >= 10 ? 0 : 1)}%`;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`)
    .join(' ');
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--text-mute)' }}
      />
    </svg>
  );
}

export default function StatCard({
  label,
  value,
  icon,
  secondary,
  trend,
  trendLabel,
  spark,
  live,
  className,
}: StatCardProps) {
  const direction = trend == null ? 'flat' : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';

  return (
    <div className={cn(styles.card, className)}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <div className={styles.value}>
        {value}
        {secondary != null && (
          <span className={styles.secondary}>{secondary}</span>
        )}
        {live && <LiveDot />}
      </div>
      {trend != null && (
        <div
          className={cn(
            styles.trend,
            direction === 'up' && styles.trendUp,
            direction === 'down' && styles.trendDown,
            direction === 'flat' && styles.trendFlat
          )}
        >
          {direction === 'up' && <IconTrendingUp size={12} strokeWidth={2} />}
          {direction === 'down' && <IconTrendingDown size={12} strokeWidth={2} />}
          {direction === 'flat' && <IconMinus size={12} strokeWidth={2} />}
          <span>{formatPct(trend)}</span>
          {trendLabel && <span className={styles.help}>{trendLabel}</span>}
        </div>
      )}
      {spark && spark.length > 1 && <Sparkline data={spark} />}
    </div>
  );
}

/**
 * Slow-pulsing presence dot. ~2s cycle, opacity drifts between 1
 * and 0.4, halo expands subtly. Intentionally calm — the tile reads
 * as "live" without strobing the dashboard.
 */
function LiveDot() {
  return (
    <span className={styles.liveDot} aria-label="live" role="img">
      <span className={styles.liveDotHalo} aria-hidden="true" />
      <span className={styles.liveDotCore} aria-hidden="true" />
    </span>
  );
}
