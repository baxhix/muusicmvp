'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table, { type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Dialog';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  IconSearch,
  IconEye,
  IconTrash,
  IconMessage,
  IconUsers,
} from '@/components/icons';
import { communitiesService } from '@/services/communities';
import { resolveAssetUrl } from '@/lib/utils';
import type { AdminCommunity } from '@/types';
import styles from './page.module.css';

/**
 * Comunidades CMS — listing entry.
 *
 * Live data only (path is `/api/admin/communities` → httpDriver).
 * Three columns of real signal: counters (members / topics /
 * comments), creator, and last activity. The destructive Apagar
 * action cascades through every dependent row server-side, so a
 * delete from here is a true "remove this community everywhere".
 */

function formatRelativeDate(iso: string): { main: string; hint: string } {
  const dt = new Date(iso);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(2);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return { main: `${dd}/${mm}/${yy}`, hint: `${hh}:${mi}` };
}

export default function AdminCommunitiesPage() {
  const router = useRouter();
  const { push } = useToast();
  const [items, setItems] = useState<AdminCommunity[] | null>(null);
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminCommunity | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const res = await communitiesService.list({
        search: search.trim() || undefined,
        limit: 200,
      });
      setItems(res.items);
    } catch (err) {
      console.error('communities list failed:', err);
      setItems([]);
      push({
        type: 'error',
        title: 'Falha ao carregar comunidades',
        description: 'Tente recarregar a página em instantes.',
      });
    }
  }, [search, push]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await communitiesService.remove(pendingDelete.slug);
      setItems((prev) =>
        prev ? prev.filter((c) => c.id !== pendingDelete.id) : prev,
      );
      push({
        type: 'success',
        title: 'Comunidade apagada',
        description: `${pendingDelete.name} e tudo dentro dela foi removido.`,
      });
      setPendingDelete(null);
    } catch (err) {
      console.error('delete failed:', err);
      push({ type: 'error', title: 'Não foi possível apagar' });
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, push]);

  const columns = useMemo<Column<AdminCommunity>[]>(
    () => [
      {
        id: 'name',
        header: 'Comunidade',
        sortKey: (c) => c.name,
        cell: (c) => (
          <div className={styles.nameCell}>
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveAssetUrl(c.imageUrl)}
                alt=""
                className={styles.thumb}
              />
            ) : (
              <span className={styles.thumbPlaceholder} aria-hidden="true">
                <IconMessage size={16} />
              </span>
            )}
            <div className={styles.nameText}>
              <span className={styles.nameMain}>{c.name}</span>
              <span className={styles.nameSlug}>/{c.slug}</span>
            </div>
          </div>
        ),
      },
      {
        id: 'creator',
        header: 'Criador',
        width: 220,
        sortKey: (c) => c.creatorName ?? c.creatorEmail ?? '',
        cell: (c) =>
          c.creatorId ? (
            <div className={styles.creatorCell}>
              <Avatar
                size="sm"
                name={c.creatorName ?? c.creatorEmail ?? '?'}
                src={
                  c.creatorAvatar ? resolveAssetUrl(c.creatorAvatar) : undefined
                }
              />
              <div className={styles.creatorText}>
                <span className={styles.creatorName}>
                  {c.creatorName ?? c.creatorEmail ?? '—'}
                </span>
                {c.creatorEmail && c.creatorName && (
                  <span className={styles.creatorEmail}>{c.creatorEmail}</span>
                )}
              </div>
            </div>
          ) : (
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
              sem criador
            </span>
          ),
      },
      {
        id: 'members',
        header: 'Membros',
        width: 90,
        align: 'right',
        sortKey: (c) => c.memberCount,
        cell: (c) => (
          <span className={styles.metric}>
            {c.memberCount.toLocaleString('pt-BR')}
          </span>
        ),
      },
      {
        id: 'topics',
        header: 'Tópicos',
        width: 90,
        align: 'right',
        sortKey: (c) => c.topicCount,
        cell: (c) => (
          <span className={styles.metric}>
            {c.topicCount.toLocaleString('pt-BR')}
          </span>
        ),
      },
      {
        id: 'comments',
        header: 'Comentários',
        width: 110,
        align: 'right',
        sortKey: (c) => c.commentCount,
        cell: (c) => (
          <span className={styles.metric}>
            {c.commentCount.toLocaleString('pt-BR')}
          </span>
        ),
      },
      {
        id: 'lastActivity',
        header: 'Última atividade',
        width: 130,
        sortKey: (c) => c.lastActivityAt,
        cell: (c) => {
          const fmt = formatRelativeDate(c.lastActivityAt);
          return (
            <div className={styles.dateCell}>
              <span className={styles.dateMain}>{fmt.main}</span>
              <span className={styles.dateHint}>{fmt.hint}</span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        align: 'right',
        width: 130,
        cell: (c) => (
          <div
            className={styles.cellActions}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Abrir"
              title="Abrir"
              onClick={() => router.push(`/comunidades/${c.slug}`)}
            >
              <IconEye size={14} />
            </Button>
            <Button
              variant="dangerGhost"
              size="sm"
              iconOnly
              aria-label="Apagar"
              title="Apagar"
              onClick={() => setPendingDelete(c)}
            >
              <IconTrash size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [router],
  );

  return (
    <>
      <PageHeader
        title="Comunidades"
        description="Gerencie as comunidades criadas pelos usuários — membros, tópicos e comentários."
      />

      <div className={styles.body}>
        <Card>
          <CardHeader
            title="Lista de comunidades"
            description="Clique em uma linha para inspecionar membros, tópicos e moderar conteúdo."
          />

          <div className={styles.filters}>
            <Input
              inputSize="md"
              placeholder="Buscar por nome, descrição ou slug"
              leadingIcon={<IconSearch size={14} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Table<AdminCommunity>
            columns={columns}
            data={items ?? []}
            rowId={(c) => c.id}
            onRowClick={(c) => router.push(`/comunidades/${c.slug}`)}
            pageSize={12}
            loading={items === null}
            emptyState={
              <EmptyState
                icon={<IconUsers size={20} />}
                title="Nenhuma comunidade ainda"
                description="Quando um usuário com 10k+ Fanpoints criar a primeira, ela aparece aqui."
              />
            }
          />
        </Card>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => (deleting ? undefined : setPendingDelete(null))}
        onConfirm={confirmDelete}
        destructive
        loading={deleting}
        title={pendingDelete ? `Apagar "${pendingDelete.name}"?` : ''}
        description="Esta ação remove a comunidade, todos os tópicos, comentários e reações. Não pode ser desfeita."
        confirmLabel="Apagar comunidade"
      />
    </>
  );
}
