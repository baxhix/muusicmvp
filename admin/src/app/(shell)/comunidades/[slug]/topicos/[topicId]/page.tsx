'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Switch from '@/components/ui/Switch';
import Table, { type Column } from '@/components/ui/Table';
import Dialog, { ConfirmDialog } from '@/components/ui/Dialog';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  IconEdit,
  IconHeart,
  IconMessage,
  IconTrash,
} from '@/components/icons';
import { communitiesService } from '@/services/communities';
import { resolveAssetUrl } from '@/lib/utils';
import type {
  AdminCommunityTopic,
  AdminCommunityTopicComment,
} from '@/types';
import styles from './page.module.css';

/**
 * Topic detail (admin) — full body inspection + comment moderation.
 *
 * The page is two cards: the topic itself (with edit + visibility
 * + hard-delete) and the threaded comment list below. The comment
 * table supports:
 *   - "Visível" toggle (soft-delete / restore) per row
 *   - hard-delete with a confirm
 *   - parent_comment_id shown inline so the admin can tell a reply
 *     apart from a top-level comment without leaving the page.
 *
 * The "Incluir ocultos" switch flips between live-only and the
 * full audit view (so the admin can restore something they
 * accidentally hid).
 */

function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(2);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

export default function AdminTopicDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; topicId: string }>();
  const slug = params.slug;
  const topicId = params.topicId;
  const { push } = useToast();

  const [topic, setTopic] = useState<AdminCommunityTopic | null>(null);
  const [comments, setComments] = useState<
    AdminCommunityTopicComment[] | null
  >(null);
  const [includeDeletedComments, setIncludeDeletedComments] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit-topic state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', body: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete-topic / delete-comment state
  const [pendingDeleteTopic, setPendingDeleteTopic] = useState(false);
  const [deletingTopic, setDeletingTopic] = useState(false);
  const [pendingDeleteComment, setPendingDeleteComment] =
    useState<AdminCommunityTopicComment | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);

  /* ── Fetchers ─────────────────────────────────────── */

  const fetchTopic = useCallback(async () => {
    try {
      const res = await communitiesService.getTopic(slug, topicId);
      setTopic(res.topic);
      setEditForm({ title: res.topic.title, body: res.topic.body ?? '' });
    } catch (err) {
      console.error('topic fetch failed:', err);
      push({ type: 'error', title: 'Tópico não encontrado' });
    }
  }, [slug, topicId, push]);

  const fetchComments = useCallback(async () => {
    try {
      const res = await communitiesService.listComments(slug, topicId, {
        includeDeleted: includeDeletedComments,
        limit: 500,
      });
      setComments(res.items);
    } catch (err) {
      console.error('comments fetch failed:', err);
      setComments([]);
    }
  }, [slug, topicId, includeDeletedComments]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchTopic(), fetchComments()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchTopic, fetchComments]);

  /* ── Topic actions ────────────────────────────────── */

  const saveTopic = useCallback(async () => {
    setSavingEdit(true);
    try {
      const res = await communitiesService.patchTopic(slug, topicId, {
        title: editForm.title.trim() || undefined,
        body: editForm.body.trim() || null,
      });
      setTopic(res.topic);
      push({ type: 'success', title: 'Tópico atualizado' });
      setEditOpen(false);
    } catch (err) {
      console.error('save topic failed:', err);
      push({ type: 'error', title: 'Não foi possível salvar' });
    } finally {
      setSavingEdit(false);
    }
  }, [slug, topicId, editForm, push]);

  const toggleTopicVisibility = useCallback(async () => {
    if (!topic) return;
    try {
      const res = await communitiesService.patchTopic(slug, topicId, {
        deletedAt: topic.deletedAt ? null : true,
      });
      setTopic(res.topic);
    } catch (err) {
      console.error('toggle visibility failed:', err);
      push({ type: 'error', title: 'Não foi possível atualizar' });
    }
  }, [slug, topicId, topic, push]);

  const deleteTopic = useCallback(async () => {
    setDeletingTopic(true);
    try {
      await communitiesService.removeTopic(slug, topicId, { hard: true });
      push({ type: 'success', title: 'Tópico apagado' });
      router.replace(`/comunidades/${slug}`);
    } catch (err) {
      console.error('delete topic failed:', err);
      push({ type: 'error', title: 'Não foi possível apagar' });
      setDeletingTopic(false);
    }
  }, [slug, topicId, push, router]);

  /* ── Comment actions ──────────────────────────────── */

  const toggleCommentVisibility = useCallback(
    async (c: AdminCommunityTopicComment) => {
      try {
        await communitiesService.patchComment(
          slug,
          topicId,
          c.id,
          c.deletedAt ? null : true,
        );
        // Refetch is cleaner here: the soft-delete clears the body,
        // which we can't reconstruct client-side on restore. The
        // server is the source of truth.
        await fetchComments();
        if (topic) {
          setTopic({
            ...topic,
            commentCount: c.deletedAt
              ? topic.commentCount + 1
              : Math.max(topic.commentCount - 1, 0),
          });
        }
      } catch (err) {
        console.error('toggle comment failed:', err);
        push({ type: 'error', title: 'Não foi possível atualizar' });
      }
    },
    [slug, topicId, topic, fetchComments, push],
  );

  const confirmDeleteComment = useCallback(async () => {
    if (!pendingDeleteComment) return;
    setDeletingComment(true);
    try {
      await communitiesService.removeComment(
        slug,
        topicId,
        pendingDeleteComment.id,
        { hard: true },
      );
      // If the comment had a body (wasn't soft-deleted), bump the
      // topic counter down too — the server has already done so,
      // we're mirroring locally.
      if (!pendingDeleteComment.deletedAt && topic) {
        setTopic({
          ...topic,
          commentCount: Math.max(topic.commentCount - 1, 0),
        });
      }
      await fetchComments();
      push({ type: 'success', title: 'Comentário apagado' });
      setPendingDeleteComment(null);
    } catch (err) {
      console.error('delete comment failed:', err);
      push({ type: 'error', title: 'Não foi possível apagar' });
    } finally {
      setDeletingComment(false);
    }
  }, [slug, topicId, pendingDeleteComment, topic, fetchComments, push]);

  /* ── Table columns ────────────────────────────────── */

  const columns = useMemo<Column<AdminCommunityTopicComment>[]>(
    () => [
      {
        id: 'author',
        header: 'Autor',
        width: 200,
        sortKey: (c) => c.author.name ?? c.author.email ?? '',
        cell: (c) =>
          c.author.id ? (
            <div className={styles.userCell}>
              <Avatar
                size="sm"
                name={c.author.name ?? c.author.email ?? '?'}
                src={
                  c.author.avatarUrl
                    ? resolveAssetUrl(c.author.avatarUrl)
                    : undefined
                }
              />
              <div className={styles.userText}>
                <span className={styles.userName}>
                  {c.author.name ?? c.author.email ?? '—'}
                </span>
                {c.author.email && c.author.name && (
                  <span className={styles.userEmail}>{c.author.email}</span>
                )}
              </div>
            </div>
          ) : (
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
              anônimo
            </span>
          ),
      },
      {
        id: 'body',
        header: 'Comentário',
        cell: (c) => (
          <div className={styles.commentCell}>
            {c.parentCommentId && (
              <span className={styles.replyTag}>resposta</span>
            )}
            <span
              className={`${styles.commentBody} ${c.deletedAt ? styles.commentBodyDeleted : ''}`}
            >
              {c.deletedAt ? '[oculto pelo admin]' : c.body}
            </span>
          </div>
        ),
      },
      {
        id: 'reactions',
        header: '❤️',
        width: 60,
        align: 'right',
        sortKey: (c) => c.reactionCount,
        cell: (c) => (
          <span className={styles.metric}>
            {c.reactionCount.toLocaleString('pt-BR')}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Enviado',
        width: 130,
        sortKey: (c) => c.createdAt,
        cell: (c) => (
          <span className={styles.dateText}>{formatDateTime(c.createdAt)}</span>
        ),
      },
      {
        id: 'visibility',
        header: 'Visível',
        width: 90,
        align: 'center',
        cell: (c) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={c.deletedAt === null}
              onChange={() => toggleCommentVisibility(c)}
              aria-label={c.deletedAt ? 'Restaurar' : 'Ocultar'}
            />
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Ações',
        align: 'right',
        width: 90,
        cell: (c) => (
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            aria-label="Apagar"
            title="Apagar definitivamente"
            onClick={() => setPendingDeleteComment(c)}
          >
            <IconTrash size={14} />
          </Button>
        ),
      },
    ],
    [toggleCommentVisibility],
  );

  /* ── Render ───────────────────────────────────────── */

  if (!topic && !loading) {
    return (
      <>
        <PageHeader title="Tópico não encontrado" />
        <div className={styles.body}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/comunidades/${slug}`)}
          >
            ← Voltar
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={topic?.title ?? 'Tópico'}
        description={`Comunidade: /${slug}`}
        actions={
          topic && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/comunidades/${slug}`)}
              >
                ← Voltar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<IconEdit size={14} />}
                onClick={() => setEditOpen(true)}
              >
                Editar
              </Button>
              <Button
                variant="danger"
                size="sm"
                leadingIcon={<IconTrash size={14} />}
                onClick={() => setPendingDeleteTopic(true)}
              >
                Apagar
              </Button>
            </>
          )
        }
      />

      <div className={styles.body}>
        {topic && (
          <>
            <div className={styles.stats}>
              <StatCard
                label="Comentários"
                value={topic.commentCount}
                icon={<IconMessage size={16} />}
              />
              <StatCard
                label="Status"
                value={topic.deletedAt ? 'Oculto' : 'Visível'}
              />
              <StatCard
                label="Criado em"
                value={formatDateTime(topic.createdAt)}
              />
            </div>

            <Card>
              <CardHeader
                title="Tópico"
                description={
                  topic.deletedAt
                    ? 'Este tópico está oculto do app. Apenas o admin enxerga.'
                    : 'Conteúdo público visível para os membros da comunidade.'
                }
                actions={
                  <label className={styles.toggleLabel}>
                    <Switch
                      checked={topic.deletedAt === null}
                      onChange={toggleTopicVisibility}
                      aria-label={topic.deletedAt ? 'Restaurar' : 'Ocultar'}
                    />
                    {topic.deletedAt ? 'Restaurar' : 'Visível'}
                  </label>
                }
              />
              <div className={styles.topicCard}>
                <div className={styles.topicAuthor}>
                  {topic.authorId ? (
                    <>
                      <Avatar
                        size="sm"
                        name={topic.authorName ?? topic.authorEmail ?? '?'}
                        src={
                          topic.authorAvatar
                            ? resolveAssetUrl(topic.authorAvatar)
                            : undefined
                        }
                      />
                      <div className={styles.userText}>
                        <span className={styles.userName}>
                          {topic.authorName ?? topic.authorEmail}
                        </span>
                        {topic.authorEmail && topic.authorName && (
                          <span className={styles.userEmail}>
                            {topic.authorEmail}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                      anônimo
                    </span>
                  )}
                </div>
                {topic.body ? (
                  <p className={styles.topicBody}>{topic.body}</p>
                ) : (
                  <p className={styles.topicEmpty}>
                    Tópico sem corpo — só o título.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Comentários"
                description="Toggle 'Visível' aplica soft-delete reversível. Apagar é definitivo (remove reações também)."
                actions={
                  <label className={styles.toggleLabel}>
                    <Switch
                      checked={includeDeletedComments}
                      onChange={(e) =>
                        setIncludeDeletedComments(e.target.checked)
                      }
                    />
                    Incluir ocultos
                  </label>
                }
              />
              <Table<AdminCommunityTopicComment>
                columns={columns}
                data={comments ?? []}
                rowId={(c) => c.id}
                pageSize={20}
                loading={comments === null}
                emptyState={
                  <EmptyState
                    icon={<IconHeart size={20} />}
                    title="Sem comentários"
                    description="Quando alguém comentar, aparece aqui."
                  />
                }
              />
            </Card>
          </>
        )}
      </div>

      {/* ── Edit-topic modal ── */}
      <Dialog
        open={editOpen}
        onClose={() => (savingEdit ? undefined : setEditOpen(false))}
        title="Editar tópico"
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditOpen(false)}
              disabled={savingEdit}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={saveTopic}
              loading={savingEdit}
              disabled={!editForm.title.trim()}
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Título</span>
            <Input
              inputSize="md"
              value={editForm.title}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, title: e.target.value }))
              }
              maxLength={200}
            />
          </label>
          <label className={styles.field}>
            <span>Corpo</span>
            <Textarea
              value={editForm.body}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, body: e.target.value }))
              }
              rows={6}
              maxLength={4000}
            />
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={pendingDeleteTopic}
        onClose={() =>
          deletingTopic ? undefined : setPendingDeleteTopic(false)
        }
        onConfirm={deleteTopic}
        destructive
        loading={deletingTopic}
        title={topic ? `Apagar tópico "${topic.title}"?` : ''}
        description="Apaga o tópico, todos os comentários e reações. Para apenas ocultar, use o toggle 'Visível'."
        confirmLabel="Apagar definitivamente"
      />

      <ConfirmDialog
        open={pendingDeleteComment !== null}
        onClose={() =>
          deletingComment ? undefined : setPendingDeleteComment(null)
        }
        onConfirm={confirmDeleteComment}
        destructive
        loading={deletingComment}
        title="Apagar comentário?"
        description="O comentário e suas reações são removidos definitivamente. Para apenas ocultar do app, use o toggle 'Visível'."
        confirmLabel="Apagar"
      />
    </>
  );
}
