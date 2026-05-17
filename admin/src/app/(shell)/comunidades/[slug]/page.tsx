'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Table, { type Column } from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import Dialog, { ConfirmDialog } from '@/components/ui/Dialog';
import Switch from '@/components/ui/Switch';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  IconArrowRight,
  IconBan,
  IconEdit,
  IconEye,
  IconMessage,
  IconSearch,
  IconStar,
  IconTrash,
  IconUsers,
} from '@/components/icons';
import { communitiesService } from '@/services/communities';
import { resolveAssetUrl } from '@/lib/utils';
import type {
  AdminCommunity,
  AdminCommunityMember,
  AdminCommunityTopic,
} from '@/types';
import styles from './page.module.css';

type TabId = 'members' | 'topics';

function formatDate(iso: string): { main: string; hint: string } {
  const dt = new Date(iso);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(2);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return { main: `${dd}/${mm}/${yy}`, hint: `${hh}:${mi}` };
}

export default function AdminCommunityDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { push } = useToast();

  const [community, setCommunity] = useState<AdminCommunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('topics');

  // Member sub-state
  const [members, setMembers] = useState<AdminCommunityMember[] | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [pendingKick, setPendingKick] = useState<AdminCommunityMember | null>(
    null,
  );
  const [kicking, setKicking] = useState(false);

  // Topic sub-state
  const [topics, setTopics] = useState<AdminCommunityTopic[] | null>(null);
  const [topicSearch, setTopicSearch] = useState('');
  const [includeDeletedTopics, setIncludeDeletedTopics] = useState(false);
  const [pendingDeleteTopic, setPendingDeleteTopic] =
    useState<AdminCommunityTopic | null>(null);
  const [deletingTopic, setDeletingTopic] = useState(false);

  // Edit-community sub-state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete-community sub-state
  const [pendingDeleteCommunity, setPendingDeleteCommunity] = useState(false);
  const [deletingCommunity, setDeletingCommunity] = useState(false);

  /* ── Fetchers ─────────────────────────────────────── */

  const fetchCommunity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communitiesService.get(slug);
      setCommunity(res.community);
      setEditForm({
        name: res.community.name,
        description: res.community.description ?? '',
        imageUrl: res.community.imageUrl ?? '',
      });
    } catch (err) {
      console.error('community detail fetch failed:', err);
      push({ type: 'error', title: 'Comunidade não encontrada' });
    } finally {
      setLoading(false);
    }
  }, [slug, push]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await communitiesService.listMembers(slug, {
        search: memberSearch.trim() || undefined,
        limit: 200,
      });
      setMembers(res.items);
    } catch (err) {
      console.error('members fetch failed:', err);
      setMembers([]);
    }
  }, [slug, memberSearch]);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await communitiesService.listTopics(slug, {
        search: topicSearch.trim() || undefined,
        includeDeleted: includeDeletedTopics,
        limit: 200,
      });
      setTopics(res.items);
    } catch (err) {
      console.error('topics fetch failed:', err);
      setTopics([]);
    }
  }, [slug, topicSearch, includeDeletedTopics]);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  useEffect(() => {
    if (tab === 'members') fetchMembers();
  }, [tab, fetchMembers]);

  useEffect(() => {
    if (tab === 'topics') fetchTopics();
  }, [tab, fetchTopics]);

  /* ── Edit community ───────────────────────────────── */

  const saveEdit = useCallback(async () => {
    if (!community) return;
    setSavingEdit(true);
    try {
      const res = await communitiesService.update(community.slug, {
        name: editForm.name.trim() || undefined,
        description: editForm.description.trim() || null,
        imageUrl: editForm.imageUrl.trim() || null,
      });
      setCommunity(res.community);
      push({ type: 'success', title: 'Comunidade atualizada' });
      setEditOpen(false);
    } catch (err) {
      console.error('update failed:', err);
      push({ type: 'error', title: 'Não foi possível salvar' });
    } finally {
      setSavingEdit(false);
    }
  }, [community, editForm, push]);

  /* ── Delete community ─────────────────────────────── */

  const deleteCommunity = useCallback(async () => {
    if (!community) return;
    setDeletingCommunity(true);
    try {
      await communitiesService.remove(community.slug);
      push({
        type: 'success',
        title: 'Comunidade apagada',
        description: `${community.name} foi removida.`,
      });
      router.replace('/comunidades');
    } catch (err) {
      console.error('delete failed:', err);
      push({ type: 'error', title: 'Não foi possível apagar' });
      setDeletingCommunity(false);
    }
  }, [community, push, router]);

  /* ── Kick member ──────────────────────────────────── */

  const confirmKick = useCallback(async () => {
    if (!pendingKick || !community) return;
    setKicking(true);
    try {
      await communitiesService.removeMember(community.slug, pendingKick.userId);
      setMembers((prev) =>
        prev ? prev.filter((m) => m.userId !== pendingKick.userId) : prev,
      );
      setCommunity((prev) =>
        prev ? { ...prev, memberCount: Math.max(prev.memberCount - 1, 0) } : prev,
      );
      push({
        type: 'success',
        title: 'Membro removido',
        description: `${pendingKick.name ?? pendingKick.email} saiu da comunidade.`,
      });
      setPendingKick(null);
    } catch (err) {
      console.error('kick failed:', err);
      push({ type: 'error', title: 'Não foi possível remover' });
    } finally {
      setKicking(false);
    }
  }, [pendingKick, community, push]);

  /* ── Delete topic ─────────────────────────────────── */

  const confirmDeleteTopic = useCallback(async () => {
    if (!pendingDeleteTopic || !community) return;
    setDeletingTopic(true);
    try {
      await communitiesService.removeTopic(
        community.slug,
        pendingDeleteTopic.id,
        { hard: true },
      );
      setTopics((prev) =>
        prev ? prev.filter((t) => t.id !== pendingDeleteTopic.id) : prev,
      );
      setCommunity((prev) =>
        prev ? { ...prev, topicCount: Math.max(prev.topicCount - 1, 0) } : prev,
      );
      push({ type: 'success', title: 'Tópico apagado' });
      setPendingDeleteTopic(null);
    } catch (err) {
      console.error('delete topic failed:', err);
      push({ type: 'error', title: 'Não foi possível apagar' });
    } finally {
      setDeletingTopic(false);
    }
  }, [pendingDeleteTopic, community, push]);

  /* ── Soft-delete / restore topic ──────────────────── */

  const toggleTopicSoftDelete = useCallback(
    async (topic: AdminCommunityTopic) => {
      if (!community) return;
      try {
        const res = await communitiesService.patchTopic(
          community.slug,
          topic.id,
          { deletedAt: topic.deletedAt ? null : true },
        );
        setTopics((prev) =>
          prev ? prev.map((t) => (t.id === res.topic.id ? res.topic : t)) : prev,
        );
        // The visible-topic counter only flips when we toggle the
        // soft-delete bit (hard delete drops it permanently).
        setCommunity((prev) =>
          prev
            ? {
                ...prev,
                topicCount: topic.deletedAt
                  ? prev.topicCount + 1
                  : Math.max(prev.topicCount - 1, 0),
              }
            : prev,
        );
      } catch (err) {
        console.error('toggle topic delete failed:', err);
        push({ type: 'error', title: 'Não foi possível atualizar' });
      }
    },
    [community, push],
  );

  /* ── Table columns ────────────────────────────────── */

  const memberColumns = useMemo<Column<AdminCommunityMember>[]>(
    () => [
      {
        id: 'name',
        header: 'Usuário',
        sortKey: (m) => m.name ?? m.email,
        cell: (m) => (
          <div className={styles.userCell}>
            <Avatar
              size="sm"
              name={m.name ?? m.email}
              src={m.avatarUrl ? resolveAssetUrl(m.avatarUrl) : undefined}
            />
            <div className={styles.userText}>
              <span className={styles.userName}>
                {m.name ?? m.email.split('@')[0]}
                {m.isCreator && (
                  <span className={styles.creatorBadge}>
                    <IconStar size={10} /> Criador
                  </span>
                )}
              </span>
              <span className={styles.userEmail}>{m.email}</span>
            </div>
          </div>
        ),
      },
      {
        id: 'joinedAt',
        header: 'Entrou em',
        width: 130,
        sortKey: (m) => m.joinedAt,
        cell: (m) => {
          const fmt = formatDate(m.joinedAt);
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
        width: 100,
        cell: (m) => (
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            aria-label="Remover da comunidade"
            title={m.isCreator ? 'Remover criador da comunidade' : 'Remover'}
            onClick={() => setPendingKick(m)}
          >
            <IconBan size={14} />
          </Button>
        ),
      },
    ],
    [],
  );

  const topicColumns = useMemo<Column<AdminCommunityTopic>[]>(
    () => [
      {
        id: 'title',
        header: 'Tópico',
        sortKey: (t) => t.title,
        cell: (t) => (
          <div className={styles.topicTitleCell}>
            <span
              className={`${styles.topicTitle} ${t.deletedAt ? styles.topicTitleDeleted : ''}`}
            >
              {t.title}
            </span>
            {t.body && (
              <span className={styles.topicBody}>{t.body.slice(0, 80)}</span>
            )}
            {t.deletedAt && (
              <span className={styles.deletedTag}>oculto</span>
            )}
          </div>
        ),
      },
      {
        id: 'author',
        header: 'Autor',
        width: 200,
        sortKey: (t) => t.authorName ?? t.authorEmail ?? '',
        cell: (t) =>
          t.authorId ? (
            <div className={styles.userCell}>
              <Avatar
                size="sm"
                name={t.authorName ?? t.authorEmail ?? '?'}
                src={
                  t.authorAvatar ? resolveAssetUrl(t.authorAvatar) : undefined
                }
              />
              <div className={styles.userText}>
                <span className={styles.userName}>
                  {t.authorName ?? t.authorEmail}
                </span>
              </div>
            </div>
          ) : (
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
              anônimo
            </span>
          ),
      },
      {
        id: 'comments',
        header: 'Comentários',
        width: 100,
        align: 'right',
        sortKey: (t) => t.commentCount,
        cell: (t) => (
          <span className={styles.metric}>
            {t.commentCount.toLocaleString('pt-BR')}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Criado',
        width: 130,
        sortKey: (t) => t.createdAt,
        cell: (t) => {
          const fmt = formatDate(t.createdAt);
          return (
            <div className={styles.dateCell}>
              <span className={styles.dateMain}>{fmt.main}</span>
              <span className={styles.dateHint}>{fmt.hint}</span>
            </div>
          );
        },
      },
      {
        id: 'visibility',
        header: 'Visível',
        width: 90,
        align: 'center',
        cell: (t) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={t.deletedAt === null}
              onChange={() => toggleTopicSoftDelete(t)}
              aria-label={t.deletedAt ? 'Restaurar' : 'Ocultar'}
            />
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Ações',
        align: 'right',
        width: 130,
        cell: (t) => (
          <div
            className={styles.cellActions}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Comentários"
              title="Ver comentários"
              onClick={() =>
                router.push(`/comunidades/${slug}/topicos/${t.id}`)
              }
            >
              <IconEye size={14} />
            </Button>
            <Button
              variant="dangerGhost"
              size="sm"
              iconOnly
              aria-label="Apagar tópico"
              title="Apagar definitivamente"
              onClick={() => setPendingDeleteTopic(t)}
            >
              <IconTrash size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [router, slug, toggleTopicSoftDelete],
  );

  /* ── Render ───────────────────────────────────────── */

  if (!community && !loading) {
    return (
      <>
        <PageHeader title="Comunidade não encontrada" />
        <div className={styles.body}>
          <Button variant="ghost" size="sm" onClick={() => router.push('/comunidades')}>
            ← Voltar
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={community?.name ?? 'Comunidade'}
        description={community ? `/${community.slug}` : undefined}
        actions={
          community && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/comunidades')}
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
                onClick={() => setPendingDeleteCommunity(true)}
              >
                Apagar
              </Button>
            </>
          )
        }
      />

      <div className={styles.body}>
        {community && (
          <>
            <div className={styles.stats}>
              <StatCard label="Membros" value={community.memberCount} icon={<IconUsers size={16} />} />
              <StatCard label="Tópicos" value={community.topicCount} icon={<IconMessage size={16} />} />
              <StatCard label="Comentários" value={community.commentCount} />
            </div>

            {community.description && (
              <Card>
                <CardHeader title="Descrição" />
                <div className={styles.descBlock}>{community.description}</div>
              </Card>
            )}

            <Card>
              <div className={styles.tabsRow}>
                <Tabs<TabId>
                  items={[
                    { id: 'topics', label: 'Tópicos', count: community.topicCount, icon: <IconMessage size={12} /> },
                    { id: 'members', label: 'Membros', count: community.memberCount, icon: <IconUsers size={12} /> },
                  ]}
                  value={tab}
                  onChange={setTab}
                  variant="bordered"
                />
              </div>

              {tab === 'topics' && (
                <>
                  <div className={styles.filters}>
                    <Input
                      inputSize="md"
                      placeholder="Buscar por título ou corpo"
                      leadingIcon={<IconSearch size={14} />}
                      value={topicSearch}
                      onChange={(e) => setTopicSearch(e.target.value)}
                    />
                    <label className={styles.toggleLabel}>
                      <Switch
                        checked={includeDeletedTopics}
                        onChange={(e) => setIncludeDeletedTopics(e.target.checked)}
                      />
                      Incluir ocultos
                    </label>
                  </div>
                  <Table<AdminCommunityTopic>
                    columns={topicColumns}
                    data={topics ?? []}
                    rowId={(t) => t.id}
                    onRowClick={(t) =>
                      router.push(`/comunidades/${slug}/topicos/${t.id}`)
                    }
                    pageSize={12}
                    loading={topics === null}
                    emptyState={
                      <EmptyState
                        icon={<IconMessage size={20} />}
                        title="Nenhum tópico"
                        description="Quando um membro publicar, aparece aqui."
                      />
                    }
                  />
                </>
              )}

              {tab === 'members' && (
                <>
                  <div className={styles.filters}>
                    <Input
                      inputSize="md"
                      placeholder="Buscar por nome ou e-mail"
                      leadingIcon={<IconSearch size={14} />}
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                  </div>
                  <Table<AdminCommunityMember>
                    columns={memberColumns}
                    data={members ?? []}
                    rowId={(m) => m.userId}
                    pageSize={12}
                    loading={members === null}
                    emptyState={
                      <EmptyState
                        icon={<IconUsers size={20} />}
                        title="Nenhum membro"
                        description="A comunidade ainda não tem membros."
                      />
                    }
                  />
                </>
              )}
            </Card>
          </>
        )}
      </div>

      {/* ── Edit community modal ── */}
      <Dialog
        open={editOpen}
        onClose={() => (savingEdit ? undefined : setEditOpen(false))}
        title="Editar comunidade"
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
              onClick={saveEdit}
              loading={savingEdit}
              disabled={!editForm.name.trim()}
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Nome</span>
            <Input
              inputSize="md"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, name: e.target.value }))
              }
              maxLength={80}
            />
          </label>
          <label className={styles.field}>
            <span>Descrição</span>
            <Textarea
              value={editForm.description}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              maxLength={500}
            />
          </label>
          <label className={styles.field}>
            <span>URL da imagem</span>
            <Input
              inputSize="md"
              value={editForm.imageUrl}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, imageUrl: e.target.value }))
              }
              placeholder="https://…"
              maxLength={500}
            />
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={pendingKick !== null}
        onClose={() => (kicking ? undefined : setPendingKick(null))}
        onConfirm={confirmKick}
        destructive
        loading={kicking}
        title={
          pendingKick
            ? `Remover ${pendingKick.name ?? pendingKick.email}?`
            : ''
        }
        description={
          pendingKick?.isCreator
            ? 'Esse usuário é o criador. Considere transferir a comunidade antes — caso contrário ela ficará sem dono.'
            : 'O membro perde acesso aos tópicos e comentários. Ele pode entrar de novo voluntariamente.'
        }
        confirmLabel="Remover membro"
      />

      <ConfirmDialog
        open={pendingDeleteTopic !== null}
        onClose={() =>
          deletingTopic ? undefined : setPendingDeleteTopic(null)
        }
        onConfirm={confirmDeleteTopic}
        destructive
        loading={deletingTopic}
        title={
          pendingDeleteTopic ? `Apagar tópico "${pendingDeleteTopic.title}"?` : ''
        }
        description="O tópico, seus comentários e reações são removidos definitivamente. Para apenas ocultar, use o toggle 'Visível' na linha."
        confirmLabel="Apagar definitivamente"
      />

      <ConfirmDialog
        open={pendingDeleteCommunity}
        onClose={() =>
          deletingCommunity ? undefined : setPendingDeleteCommunity(false)
        }
        onConfirm={deleteCommunity}
        destructive
        loading={deletingCommunity}
        title={community ? `Apagar "${community.name}"?` : ''}
        description="Esta ação remove a comunidade, todos os tópicos, comentários e reações. Não pode ser desfeita."
        confirmLabel="Apagar comunidade"
      />
    </>
  );
}
