'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NotificationEditorFull from '@/components/admin/NotificationEditorFull';
import {
  notificationsService,
  loadCustomDrafts,
  type NotificationItem,
} from '@/services/notifications';

interface PageProps {
  params: Promise<{ kind: string }>;
}

/**
 * Editor full-page de uma notificação.
 *
 * Carrega TODOS os items (catálogo é bounded — ~14 entries) e
 * filtra pelo `kind` da URL. Fallback: se não achar no catálogo,
 * tenta os drafts personalizados em localStorage (criados pelo
 * "Nova notificação"). Se nem aí estiver, redireciona pra lista.
 */
export default function NotificacaoEditPage({ params }: PageProps) {
  const { kind } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<NotificationItem | null | 'not-found'>(null);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    let cancel = false;
    notificationsService
      .list()
      .then((res) => {
        if (cancel) return;
        const found = res.items.find((i) => i.kind === kind);
        if (found) {
          setItem(found);
          return;
        }
        /* Fallback pros custom drafts (localStorage). */
        const draft = loadCustomDrafts().find((d) => d.kind === kind);
        if (draft) {
          setItem(draft);
          setIsCustom(true);
        } else {
          setItem('not-found');
        }
      })
      .catch(() => {
        if (cancel) return;
        /* Mesmo em erro de API, ainda tenta o draft local. */
        const draft = loadCustomDrafts().find((d) => d.kind === kind);
        if (draft) {
          setItem(draft);
          setIsCustom(true);
        } else {
          setItem('not-found');
        }
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

  return <NotificationEditorFull item={item} isCustomDraft={isCustom} />;
}
