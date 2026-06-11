'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import { metricsService } from '@/services/metrics';
import { formatRelative } from '@/lib/format';
import type { ActivityEntry } from '@/types';
import styles from './page.module.css';

/**
 * Atividade recente — página dedicada (cross-user). Lista as últimas
 * ações dos usuários na plataforma COM avatar, nome, categoria e
 * tempo relativo. Reusa metricsService.activity() (GET
 * /api/admin/activities), que já entrega user.avatarUrl.
 */

/** kind cru → badge de categoria (tom padronizado pelo Badge do admin). */
const KIND_BADGE: Record<
  NonNullable<ActivityEntry['kind']>,
  { label: string; tone: BadgeTone }
> = {
  stream: { label: 'Stream', tone: 'info' },
  login: { label: 'Login', tone: 'neutral' },
  chat_started: { label: 'Chat', tone: 'brand' },
};

export default function AtividadePage() {
  const [items, setItems] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    metricsService
      .activity()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Atividade recente"
        description="Últimas ações dos usuários na plataforma — streams, logins e conversas."
      />

      <Card flush>
        {items === null && !error && (
          <div className={styles.list} aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.rowSkeleton}>
                <span className={styles.skelAvatar} />
                <span className={styles.skelLine} />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className={styles.empty}>Não foi possível carregar a atividade.</div>
        )}

        {items !== null && items.length === 0 && (
          <div className={styles.empty}>Nenhuma atividade recente.</div>
        )}

        {items !== null && items.length > 0 && (
          <div className={styles.list}>
            {items.map((a) => {
              const badge = a.kind ? KIND_BADGE[a.kind] : null;
              return (
                <div key={a.id} className={styles.row}>
                  <Avatar src={a.actor?.avatar} name={a.actor?.name} size="md" />
                  <div className={styles.body}>
                    <div className={styles.subject}>
                      {a.actor && (
                        <>
                          <span className={styles.actor}>{a.actor.name}</span>{' '}
                        </>
                      )}
                      <span className={styles.copy}>{a.subject}</span>
                    </div>
                    {a.meta && <div className={styles.meta}>{a.meta}</div>}
                  </div>
                  {badge && (
                    <Badge tone={badge.tone} dot>
                      {badge.label}
                    </Badge>
                  )}
                  <span className={styles.when}>{formatRelative(a.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
