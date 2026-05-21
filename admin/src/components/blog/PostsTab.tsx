'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table, { type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import {
  IconCopy,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconSearch,
  IconTrash,
} from '@/components/icons';
import PostStatusBadge, { POST_STATUS_LABEL } from './PostStatusBadge';
import { blogPostsService } from '@/services/blog/posts';
import { blogCategoriesService } from '@/services/blog/categories';
import { blogAuthorsService } from '@/services/blog/authors';
import type {
  BlogAuthor,
  BlogCategory,
  BlogPost,
  BlogPostStatus,
} from '@/types/blog';
import styles from '@/app/(shell)/blog/page.module.css';

/** Formata uma ISO date como dd/mm/aa per product feedback
 *  "substitua o formato de data de publicação para dd/mm/aa". */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d
    .getFullYear()
    .toString()
    .slice(-2)}`;
}

/**
 * PostsTab — listagem de posts com filtros + ações rápidas.
 *
 * Filtros disponíveis:
 *   - Busca (título, subtítulo, resumo, autor, categoria)
 *   - Status (draft / scheduled / published / archived)
 *   - Categoria
 *   - Autor
 *   - Ordenação (publishedAt desc/asc, título, updatedAt)
 *
 * Ações rápidas por linha:
 *   - Editar     → navega pra /blog/posts/[id]/editar
 *   - Duplicar   → cria cópia draft + abre o editor dela
 *   - Publicar   → setStatus('published') + toast
 *   - Despublicar→ setStatus('archived') + toast
 *   - Excluir    → ConfirmDialog
 *
 * Não confundir com o IconCopy — esse é representativo, no admin
 * existente já é usado pra "duplicar". */

const STATUS_OPTIONS: { value: BlogPostStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'Todos os status' },
  { value: 'draft',     label: 'Rascunho' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived',  label: 'Arquivado' },
];

export default function PostsTab() {
  const router = useRouter();
  const { push } = useToast();

  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BlogPostStatus | 'all'>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [authorId, setAuthorId] = useState<string>('all');
  const [pendingDelete, setPendingDelete] = useState<BlogPost | null>(null);

  /** Ordenação fixa em "publicação mais recente primeiro" (UI
   *  do seletor foi retirada per product feedback). A própria
   *  coluna Publicação no Table do design system continua
   *  clicável pra reordenar localmente quando o usuário
   *  precisar de outra ordem. */
  const refresh = useCallback(async () => {
    const [postsRes, catsRes, autsRes] = await Promise.all([
      blogPostsService.list({ sort: 'publishedAt-desc' }),
      blogCategoriesService.list({ limit: 200 }),
      blogAuthorsService.list({ limit: 200 }),
    ]);
    setPosts(postsRes.items);
    setCategories(catsRes.items);
    setAuthors(autsRes.items);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (posts ?? []).filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (categoryId !== 'all' && p.categoryId !== categoryId) return false;
      if (authorId !== 'all' && p.authorId !== authorId) return false;
      if (q) {
        const hay = [
          p.title,
          p.subtitle ?? '',
          p.excerpt ?? '',
          p.authorName,
          p.categoryName,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, search, status, categoryId, authorId]);

  async function handleDuplicate(p: BlogPost) {
    try {
      const created = await blogPostsService.duplicate(p.id);
      push({
        type: 'success',
        title: 'Post duplicado',
        description: `Abrindo editor de "${created.title}".`,
      });
      router.push(`/blog/posts/${created.id}/editar`);
    } catch (err) {
      console.error('duplicate failed:', err);
      push({ type: 'error', title: 'Erro ao duplicar' });
    }
  }

  async function handlePublish(p: BlogPost) {
    const next: BlogPostStatus = p.status === 'published' ? 'archived' : 'published';
    try {
      await blogPostsService.setStatus(p.id, next);
      push({
        type: 'success',
        title: next === 'published' ? 'Post publicado' : 'Post despublicado',
        description: `"${p.title}" agora está ${POST_STATUS_LABEL[next].toLowerCase()}.`,
      });
      await refresh();
    } catch (err) {
      console.error('publish toggle failed:', err);
      push({ type: 'error', title: 'Erro ao alterar status' });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await blogPostsService.remove(pendingDelete.id);
    push({
      type: 'warning',
      title: 'Post excluído',
      description: `"${pendingDelete.title}" foi removido.`,
    });
    setPendingDelete(null);
    await refresh();
  }

  const columns: Column<BlogPost>[] = [
    {
      id: 'cover',
      header: '',
      cell: (p) => (
        <div className={styles.coverThumb}>
          {p.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.coverImageUrl}
              alt={p.coverImageAlt ?? ''}
              className={styles.coverThumbImg}
              loading="lazy"
            />
          ) : (
            <div className={styles.coverThumbEmpty} aria-hidden="true" />
          )}
        </div>
      ),
      width: 72,
    },
    {
      id: 'title',
      header: 'Post',
      sortKey: (p) => p.title,
      cell: (p) => (
        <div className={styles.cellName}>
          <span className={styles.cellPrimary}>{p.title}</span>
          <span className={styles.cellSecondary}>
            <code className={styles.slugCode}>/{p.slug}</code> · {p.readingTimeMinutes} min de leitura
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (p) => p.status,
      cell: (p) => <PostStatusBadge status={p.status} />,
      width: 115,
    },
    {
      id: 'category',
      header: 'Categoria',
      sortKey: (p) => p.categoryName,
      cell: (p) => <span className={styles.muteCell}>{p.categoryName}</span>,
      width: 140,
    },
    {
      id: 'author',
      header: 'Autor',
      sortKey: (p) => p.authorName,
      cell: (p) => (
        // Avatar isolado com o nome do autor via tooltip nativo
        // (title attr) — listagem mais densa, menos texto
        // competindo com o título do post.
        <span title={p.authorName} className={styles.authorAvatarOnly}>
          <Avatar
            name={p.authorName}
            src={p.authorAvatarUrl ?? undefined}
            size="sm"
          />
        </span>
      ),
      width: 64,
      align: 'center',
    },
    {
      id: 'publishedAt',
      header: 'Publicação',
      sortKey: (p) => p.publishedAt ?? '',
      cell: (p) => (
        <span className={styles.muteCell}>
          {p.publishedAt ? formatShortDate(p.publishedAt) : '—'}
        </span>
      ),
      width: 100,
    },
    {
      id: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (p) => {
        const publishLabel =
          p.status === 'published' ? 'Despublicar' : 'Publicar';
        return (
          <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Editar ${p.title}`}
              title="Editar"
              onClick={() => router.push(`/blog/posts/${p.id}/editar`)}
            >
              <IconEdit size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Duplicar ${p.title}`}
              title="Duplicar"
              onClick={() => void handleDuplicate(p)}
            >
              <IconCopy size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`${publishLabel} ${p.title}`}
              title={publishLabel}
              onClick={() => void handlePublish(p)}
            >
              {p.status === 'published' ? (
                <IconEyeOff size={14} />
              ) : (
                <IconEye size={14} />
              )}
            </Button>
            <Button
              variant="dangerGhost"
              size="sm"
              iconOnly
              aria-label={`Remover ${p.title}`}
              title="Remover"
              onClick={() => setPendingDelete(p)}
            >
              <IconTrash size={14} />
            </Button>
          </div>
        );
      },
      width: 160,
    },
  ];

  return (
    <div className={styles.tabBody}>
      {/* Box "Posts / Todos os posts do blog..." removido per
       *  product feedback. CTA "Novo post" migrou pro PageHeader
       *  do /blog (app/(shell)/blog/page.tsx). Filtros vão direto. */}
      <Card className={styles.filters}>
        <Input
          inputSize="md"
          placeholder="Buscar por título, autor ou categoria…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as BlogPostStatus | 'all')}
          options={STATUS_OPTIONS}
        />
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[
            { value: 'all', label: 'Todas categorias' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Select
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          options={[
            { value: 'all', label: 'Todos autores' },
            ...authors.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      </Card>

      <Card className={styles.tableCard}>
        <Table<BlogPost>
          columns={columns}
          data={filtered}
          rowId={(p) => p.id}
          pageSize={20}
          loading={posts === null}
        />
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete ? `Excluir "${pendingDelete.title}"?` : ''}
        description="O post é removido permanentemente. Backups + revisões anteriores (quando o histórico de versões for ativado) também são apagados."
        confirmLabel="Excluir post"
        destructive
      />
    </div>
  );
}
