'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NotificationEditorFull from '@/components/admin/NotificationEditorFull';
import {
  notificationsService,
  type NotificationItem,
} from '@/services/notifications';

interface PageProps {
  params: Promise<{ kind: string }>;
}

/**
 * Editor full-page de uma notificação.
 *
 * Carrega TODOS os items (catálogo é bounded — ~14 entries) e
 * filtra pelo `kind` da URL. Se não achar, redireciona pra lista.
 * Mesmo pattern do editor de templates de email.
 */
export default function NotificacaoEditPage({ params }: PageProps) {
  const { kind } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<NotificationItem | null | 'not-found'>(null);

  useEffect(() => {
    let cancel = false;
    notificationsService
      .list()
      .then((res) => {
        if (cancel) return;
        const found = res.items.find((i) => i.kind === kind);
        setItem(found ?? 'not-found');
      })
      .catch(() => {
        if (cancel) return;
        setItem('not-found');
      });
    return () => {
      cancel = true;
    };
  }, [kind]);

  useEffect(() => {
    if (item === 'not-found') {
      router.replace('/notificacoes');
    }
  }, [item, router]);

  if (item === null) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: 14,
        }}
      >
        Carregando notificação…
      </div>
    );
  }

  if (item === 'not-found') {
    return null;
  }

  return <NotificationEditorFull item={item} />;
}
