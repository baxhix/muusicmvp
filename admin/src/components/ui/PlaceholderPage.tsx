import type { ReactNode } from 'react';
import PageHeader from './PageHeader';
import { Card, CardHeader } from './Card';
import Badge from './Badge';
import { IconCheck } from '@/components/icons';
import styles from './PlaceholderPage.module.css';

export interface PlaceholderPageProps {
  title: string;
  description: string;
  scope: { label: string; meta?: string }[];
  actions?: ReactNode;
}

export default function PlaceholderPage({
  title,
  description,
  scope,
  actions,
}: PlaceholderPageProps) {
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        eyebrow={
          <>
            <Badge tone="warning" size="sm" dot>Em construção</Badge>
            Fase 2 da entrega
          </>
        }
      />
      <div className={styles.body}>
        <Card>
          <CardHeader
            title="Escopo planejado"
            description="O que essa seção entrega quando totalmente implementada — confirme antes de eu começar."
          />
          <div className={styles.scopeList}>
            {scope.map((s, i) => (
              <div key={i} className={styles.scopeItem}>
                <span className={styles.scopeIcon}>
                  <IconCheck size={12} strokeWidth={2.5} />
                </span>
                <span className={styles.scopeLabel}>{s.label}</span>
                {s.meta && <span className={styles.scopeMeta}>{s.meta}</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
