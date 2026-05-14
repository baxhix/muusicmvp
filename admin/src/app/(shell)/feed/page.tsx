'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Switch from '@/components/ui/Switch';
import Table, { type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Dialog';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  IconPlus,
  IconSearch,
  IconImage,
  IconVideo,
  IconStar,
  IconEye,
  IconEdit,
  IconTrash,
  IconFeed,
  IconCheckCircle,
} from '@/components/icons';
import FeedStatusBadge from '@/components/admin/FeedStatusBadge';
import FeedComposerDrawer from '@/components/admin/FeedComposerDrawer';
import FeedLightbox from '@/components/admin/FeedLightbox';
import { feedService } from '@/services/feed';
import type {
  FeedItem,
  FeedItemStatus,
  FeedItemType,
  FeedMediaItem,
} from '@/types';
import styles from './page.module.css';

/**
 * Feed CMS — listing + CRUD entry point.
 *
 * Real backend: lists from /api/admin/feed (auto-routed through
 * httpDriver in services/api.ts because the path starts with
 * /api/admin/). All quick actions (publish, toggle active, delete)
 * + the composer drawer call the same service.
 *
 * State strategy:
 *   - One server source of truth (`items`). Mutations call the
 *     service and replace the affected row locally; full refetch
 *     on filter change.
 *   - Quick actions (toggle, publish, delete) are optimistic with
 *     a Toast on failure; the failing case falls back to refetch
 *     so the UI converges to truth even if the local rollback
 *     drifts.
 */

const STATUS_OPTIONS = [
  { value: 'all',        label: 'Todos os status' },
  { value: 'published',  label: 'Publicado' },
  { value: 'scheduled',  label: 'Agendado' },
  { value: 'draft',      label: 'Rascunho' },
  { value: 'inactive',   label: 'Inativo' },
];

const TYPE_OPTIONS = [
  { value: 'all',       label: 'Todos os tipos' },
  { value: 'image',     label: 'Imagem' },
  { value: 'video',     label: 'Vídeo' },
  { value: 'carousel',  label: 'Carrossel' },
  { value: 'story',     label: 'Story' },
  { value: 'poll',      label: 'Enquete' },
  { value: 'sponsored', label: 'Patrocinado' },
  { value: 'broadcast', label: 'Transmissão' },
];

function typeLabel(t: FeedItemType | null): { label: string; icon: React.ReactNode } {
  switch (t) {
    case 'image':     return { label: 'Imagem',      icon: <IconImage size={12} /> };
    case 'video':     return { label: 'Vídeo',       icon: <IconVideo size={12} /> };
    case 'carousel':  return { label: 'Carrossel',   icon: <IconImage size={12} /> };
    case 'story':     return { label: 'Story',       icon: <IconFeed size={12} /> };
    case 'poll':      return { label: 'Enquete',     icon: <IconCheckCircle size={12} /> };
    case 'sponsored': return { label: 'Patrocinado', icon: <IconStar size={12} /> };
    case 'broadcast': return { label: 'Transmissão', icon: <IconEye size={12} /> };
    default:          return { label: '—',           icon: null };
  }
}

function formatDate(iso: string | null): { main: string; hint: string } {
  if (!iso) return { main: '—', hint: '' };
  const dt = new Date(iso);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(2);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return { main: `${dd}/${mm}/${yy}`, hint: `${hh}:${mi}` };
}

function publishedOrScheduledIso(p: FeedItem): string | null {
  if (p.status === 'scheduled') return p.scheduledAt;
  return p.publishedAt ?? p.updatedAt;
}

export default function AdminFeedPage() {
  const { push } = useToast();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [filters, setFilters] = useState<{
    status: FeedItemStatus | 'all';
    type: FeedItemType | 'all';
    search: string;
  }>({
    status: 'all',
    type: 'all',
    search: '',
  });

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<FeedItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FeedItem | null>(null);

  // Lightbox controls (gallery preview from the row thumbnail).
  const [lightbox, setLightbox] = useState<{
    media: FeedMediaItem[];
    index: number;
  } | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await feedService.list({
        status: filters.status,
        type: filters.type,
        search: filters.search.trim() || undefined,
        limit: 200,
      });
      setItems(res.items);
    } catch (err) {
      console.error('feed list failed:', err);
      setItems([]);
      push({
        type: 'error',
        title: 'Falha ao carregar o feed',
        description: 'Tente recarregar a página em instantes.',
      });
    }
  }, [filters, push]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /* ── Actions ───────────────────────────────────────── */

  function openCreate() {
    setEditingPost(null);
    setComposerOpen(true);
  }
  function openEdit(post: FeedItem) {
    setEditingPost(post);
    setComposerOpen(true);
  }

  async function publishNow(post: FeedItem) {
    try {
      const next = await feedService.publishNow(post.id);
      replaceLocal(next);
      push({
        type: 'success',
        title: 'Publicação ao ar',
        description: `${next.title || 'Post'} agora aparece no feed.`,
      });
    } catch (err) {
      console.error('publishNow failed:', err);
      push({ type: 'error', title: 'Não foi possível publicar' });
    }
  }

  async function toggleActive(post: FeedItem, nextActive: boolean) {
    // Optimistic flip + rollback on failure.
    replaceLocal({ ...post, isActive: nextActive });
    try {
      const next = await feedService.setActive(post.id, nextActive);
      replaceLocal(next);
    } catch (err) {
      console.error('toggleActive failed:', err);
      replaceLocal(post);
      push({ type: 'error', title: 'Falha ao alterar visibilidade' });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await feedService.remove(target.id);
      setItems((prev) => (prev ? prev.filter((p) => p.id !== target.id) : prev));
      push({
        type: 'success',
        title: 'Publicação removida',
        description: 'Comentários e reações vinculados também foram apagados.',
      });
    } catch (err) {
      console.error('delete failed:', err);
      push({ type: 'error', title: 'Não foi possível remover' });
    }
  }

  const replaceLocal = useCallback((next: FeedItem) => {
    setItems((prev) =>
      prev ? prev.map((p) => (p.id === next.id ? next : p)) : prev,
    );
  }, []);

  function onSaved(post: FeedItem) {
    setItems((prev) => {
      if (!prev) return [post];
      const exists = prev.some((p) => p.id === post.id);
      return exists
        ? prev.map((p) => (p.id === post.id ? post : p))
        : [post, ...prev];
    });
  }

  /* ── Table columns ─────────────────────────────────── */
  const columns = useMemo<Column<FeedItem>[]>(
    () => [
      {
        id: 'preview',
        header: 'Preview',
        width: 92,
        cell: (p) => (
          <div className={styles.thumbWrap}>
            {p.media.length > 0 ? (
              <button
                type="button"
                className={styles.thumb}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox({ media: p.media, index: 0 });
                }}
                aria-label="Visualizar imagens"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.media[0].url}
                  alt={p.media[0].alt ?? ''}
                  className={styles.thumbImg}
                />
                {p.media.length > 1 && (
                  <span className={styles.thumbCount}>+{p.media.length - 1}</span>
                )}
              </button>
            ) : (
              <div className={styles.thumbPlaceholder} aria-hidden="true">
                <IconImage size={20} />
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'title',
        header: 'Publicação',
        sortKey: (p) => p.title ?? p.description ?? '',
        cell: (p) => (
          <div className={styles.titleCell}>
            <span className={styles.titleText}>
              {p.title || (p.description ? p.description.slice(0, 48) : 'Sem título')}
            </span>
            {p.description && (
              <span className={styles.descText}>{p.description}</span>
            )}
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Tipo',
        width: 130,
        sortKey: (p) => p.type ?? '',
        cell: (p) => {
          const t = typeLabel(p.type);
          return (
            <span className={styles.typeChip}>
              {t.icon}
              {t.label}
              {p.media.length > 0 && (
                <span style={{ color: 'var(--text-faint)', marginLeft: 4 }}>
                  · {p.media.length}
                </span>
              )}
            </span>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        width: 130,
        sortKey: (p) => p.status ?? '',
        cell: (p) => <FeedStatusBadge status={p.status} size="sm" />,
      },
      {
        id: 'date',
        header: 'Data',
        width: 110,
        sortKey: (p) => publishedOrScheduledIso(p) ?? '',
        cell: (p) => {
          const fmt = formatDate(publishedOrScheduledIso(p));
          return (
            <div className={styles.dateCell}>
              <span className={styles.dateMain}>{fmt.main}</span>
              <span className={styles.dateHint}>{fmt.hint}</span>
            </div>
          );
        },
      },
      {
        id: 'author',
        header: 'Autor',
        width: 200,
        sortKey: (p) => p.author?.name ?? p.author?.email ?? '',
        cell: (p) =>
          p.author ? (
            <div className={styles.authorCell}>
              <Avatar
                size="sm"
                name={p.author.name ?? p.author.email}
                src={p.author.avatarUrl ?? undefined}
              />
              <div className={styles.authorText}>
                <span className={styles.authorName}>
                  {p.author.name ?? p.author.email}
                </span>
                <span className={styles.authorEmail}>{p.author.email}</span>
              </div>
            </div>
          ) : (
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>
          ),
      },
      {
        id: 'active',
        header: 'Ativo',
        width: 80,
        align: 'center',
        cell: (p) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={p.isActive}
              onChange={(e) => toggleActive(p, e.target.checked)}
              aria-label="Ativar/desativar"
            />
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Ações',
        align: 'right',
        cell: (p) => (
          <div className={styles.cellActions} onClick={(e) => e.stopPropagation()}>
            {p.media.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Visualizar"
                title="Visualizar"
                onClick={() => setLightbox({ media: p.media, index: 0 })}
              >
                <IconEye size={14} />
              </Button>
            )}
            {p.status !== 'published' && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Publicar agora"
                title="Publicar agora"
                onClick={() => publishNow(p)}
              >
                <IconCheckCircle size={14} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Editar"
              title="Editar"
              onClick={() => openEdit(p)}
            >
              <IconEdit size={14} />
            </Button>
            <Button
              variant="dangerGhost"
              size="sm"
              iconOnly
              aria-label="Apagar"
              title="Apagar"
              onClick={() => setPendingDelete(p)}
            >
              <IconTrash size={14} />
            </Button>
          </div>
        ),
      },
    ],
    // setX setters are stable; only toggleActive/publishNow change identity
    // when items changes (closures over replaceLocal) — fine to include.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <PageHeader
        title="Feed"
        description="Crie, agende e administre as publicações que vão para o feed da plataforma."
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            onClick={openCreate}
          >
            Nova publicação
          </Button>
        }
      />

      <div className={styles.body}>
        <Card>
          <CardHeader
            title="Publicações"
            description="Tudo que será exibido no feed da plataforma, com filtros por estado e tipo."
          />

          <div className={styles.filters}>
            <Input
              inputSize="md"
              placeholder="Buscar por título ou descrição"
              leadingIcon={<IconSearch size={14} />}
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <Select
              inputSize="md"
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value as FeedItemStatus | 'all' }))
              }
              options={STATUS_OPTIONS}
            />
            <Select
              inputSize="md"
              value={filters.type}
              onChange={(e) =>
                setFilters((f) => ({ ...f, type: e.target.value as FeedItemType | 'all' }))
              }
              options={TYPE_OPTIONS}
            />
          </div>

          <Table<FeedItem>
            columns={columns}
            data={items ?? []}
            rowId={(p) => p.id}
            onRowClick={openEdit}
            pageSize={12}
            loading={items === null}
            emptyState={
              <EmptyState
                icon={<IconFeed size={20} />}
                title="Nenhuma publicação ainda"
                description="Crie a primeira publicação para começar a alimentar o feed da plataforma."
                actions={
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={<IconPlus size={14} />}
                    onClick={openCreate}
                  >
                    Nova publicação
                  </Button>
                }
              />
            }
          />
        </Card>
      </div>

      <FeedComposerDrawer
        open={composerOpen}
        post={editingPost}
        onClose={() => setComposerOpen(false)}
        onSaved={onSaved}
      />

      <FeedLightbox
        open={lightbox !== null}
        items={lightbox?.media ?? []}
        index={lightbox?.index ?? 0}
        onIndexChange={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
        onClose={() => setLightbox(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        destructive
        title={
          pendingDelete
            ? `Apagar publicação?`
            : ''
        }
        description="Esta ação remove a publicação, seus comentários e reações. Não pode ser desfeita."
        confirmLabel="Apagar publicação"
      />
    </>
  );
}
