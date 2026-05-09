import type { ReactNode } from 'react';
import { IconLoader } from '@/components/icons';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export default function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      {icon && <div className={styles.iconWrap}>{icon}</div>}
      <div className={styles.title}>{title}</div>
      {description && <div className={styles.description}>{description}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className={styles.loadingWrap}>
      <IconLoader size={20} />
      <span>{label}</span>
    </div>
  );
}
