import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  tabs,
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <div className={styles.left}>
          {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {tabs && <div className={styles.tabs}>{tabs}</div>}
    </header>
  );
}
