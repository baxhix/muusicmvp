import type { ReactNode } from 'react';
import styles from './StatTile.module.css';

export interface StatTileProps {
  icon?: ReactNode;
  /** Pre-formatted main value */
  value: ReactNode;
  /** Optional secondary value shown inline (e.g. "75%") */
  pct?: string;
  label: string;
}

export default function StatTile({ icon, value, pct, label }: StatTileProps) {
  return (
    <div className={styles.tile}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <div className={styles.values}>
        <span className={styles.value}>{value}</span>
        {pct && <span className={styles.pct}>{pct}</span>}
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
