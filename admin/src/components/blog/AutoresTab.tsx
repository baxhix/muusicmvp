'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Table, { type Column } from '@/components/ui/Table';
import Dialog, { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { IconCheck, IconEdit, IconPlus, IconSearch, IconTrash } from '@/components/icons';
import BlogImageUploader from './BlogImageUploader';
import { blogAuthorsService } from '@/services/blog/authors';
import { slugify } from '@/lib/blog/slug';
import { formatRelative } from '@/lib/format';
import type { BlogAuthor } from '@/types/blog';
import styles from '@/app/(shell)/blog/page.module.css';
import editorStyles from './PostEditor.module.css';

/**
 * AutoresTab — CRUD da equipe editorial do blog.
 *
 * Cobertura idêntica ao CategoriasTab (listagem, busca,
 * paginação via Table, edição via Dialog, delete via
 * ConfirmDialog). Reusa as classes CSS da página index pra
 * manter o vocabulário visual.
 */

interface AuthorDraft {
  id: string | null;
  name: string;
  email: string;
  avatarUrl: string;
  bio: string;
  slug: string;
  slugAuto: boolean;
}

function newDraft(): AuthorDraft {
  return {
    id: null,
    name: '',
    email: '',
    avatarUrl: '',
    bio: '',
    slug: '',
    slugAuto: true,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function AutoresTab() {
  const { push } = useToast();
  const [rows, setRows] = useState<BlogAuthor[] | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AuthorDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BlogAuthor | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const { items } = await blogAuthorsService.list();
    setRows(items);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((u) => {
      if (q) {
        const hay = [u.name, u.email, u.bio ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search]);

  function openCreate() {
    setEditing(newDraft());
  }
  function openEdit(u: BlogAuthor) {
    setEditing({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl ?? '',
      bio: u.bio ?? '',
      slug: u.slug,
      slugAuto: false,
    });
  }

  async function saveDraft(draft: AuthorDraft) {
    setSaving(true);
    try {
      if (draft.id) {
        await blogAuthorsService.update(draft.id, {
          name: draft.name,
          email: draft.email,
          avatarUrl: draft.avatarUrl.trim() || null,
          bio: draft.bio.trim() || null,
          slug: draft.slug,
        });
        push({
          type: 'success',
          title: 'Autor atualizado',
          description: `"${draft.name}" salvo.`,
        });
      } else {
        await blogAuthorsService.create({
          name: draft.name,
          email: draft.email,
          avatarUrl: draft.avatarUrl.trim() || null,
          bio: draft.bio.trim() || null,
          slug: draft.slug,
        });
        push({
          type: 'success',
          title: 'Autor criado',
          description: `${draft.name} já pode assinar posts.`,
        });
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      console.error('autor save failed:', err);
      push({ type: 'error', title: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await blogAuthorsService.remove(pendingDelete.id);
    push({
      type: 'warning',
      title: 'Autor removido',
      description: `"${pendingDelete.name}" foi excluído. Posts assinados por esse autor mantêm o snapshot do nome.`,
    });
    setPendingDelete(null);
    await refresh();
  }

  const columns: Column<BlogAuthor>[] = [
    {
      id: 'author',
      header: 'Autor',
      sortKey: (u) => u.name,
      cell: (u) => (
        <div className={styles.authorCell}>
          <Avatar name={u.name} src={u.avatarUrl ?? undefined} size="md" />
          <div className={styles.authorBody}>
            <span className={styles.cellPrimary}>{u.name}</span>
            <span className={styles.cellSecondary}>{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'slug',
      header: 'Slug',
      sortKey: (u) => u.slug,
      cell: (u) => <code className={styles.slugCode}>/{u.slug}</code>,
      width: 200,
    },
    {
      id: 'postCount',
      header: 'Posts',
      sortKey: (u) => u.postCount,
      align: 'right',
      cell: (u) => <span className={styles.numCell}>{u.postCount}</span>,
      width: 80,
    },
    {
      id: 'updatedAt',
      header: 'Atualizado',
      sortKey: (u) => u.updatedAt,
      cell: (u) => <span className={styles.muteCell}>{formatRelative(u.updatedAt)}</span>,
      width: 140,
    },
    {
      id: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (u) => (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={`Editar ${u.name}`}
            title="Editar"
            onClick={() => openEdit(u)}
          >
            <IconEdit size={14} />
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            aria-label={`Remover ${u.name}`}
            title="Remover"
            onClick={() => setPendingDelete(u)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      ),
      width: 90,
    },
  ];

  return (
    <div className={styles.tabBody}>
      <Card>
        <CardHeader
          title="Autores"
          description="Perfis editoriais. Cada post precisa de um autor; nome e avatar são gravados como snapshot no momento da publicação."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={openCreate}
            >
              Novo autor
            </Button>
          }
        />
      </Card>

      <Card className={styles.filters2}>
        <Input
          inputSize="md"
          placeholder="Buscar por nome, e-mail ou bio…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <div />
      </Card>

      <Card className={styles.tableCard}>
        <Table<BlogAuthor>
          columns={columns}
          data={filtered}
          rowId={(u) => u.id}
          pageSize={20}
          loading={rows === null}
        />
      </Card>

      <AuthorDialog
        draft={editing}
        saving={saving}
        onCancel={() => setEditing(null)}
        onSave={saveDraft}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete ? `Remover "${pendingDelete.name}"?` : ''}
        description="O perfil é excluído. Posts publicados mantêm o snapshot de nome/avatar do autor — o conteúdo histórico não muda."
        confirmLabel="Remover"
        destructive
      />
    </div>
  );
}

function AuthorDialog({
  draft,
  saving,
  onCancel,
  onSave,
}: {
  draft: AuthorDraft | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (d: AuthorDraft) => void;
}) {
  const [form, setForm] = useState<AuthorDraft | null>(draft);

  useEffect(() => {
    setForm(draft);
  }, [draft]);

  if (!form) return null;

  const updateName = (name: string) => {
    setForm({
      ...form,
      name,
      slug: form.slugAuto ? slugify(name) : form.slug,
    });
  };
  const updateSlug = (slug: string) => {
    setForm({ ...form, slug: slugify(slug), slugAuto: false });
  };

  const valid =
    form.name.trim().length >= 2 &&
    isValidEmail(form.email) &&
    form.slug.trim().length >= 2;
  const isCreating = form.id === null;

  return (
    <Dialog
      open={draft !== null}
      onClose={onCancel}
      title={isCreating ? 'Novo autor' : `Editar — ${draft?.name}`}
      description="Perfil editorial. Vira a assinatura dos posts e a página /blog/autor/[slug]."
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!valid || saving}
            loading={saving}
            leadingIcon={!saving ? <IconCheck size={14} /> : undefined}
            onClick={() => onSave(form)}
          >
            {isCreating ? 'Criar' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className={styles.formBody}>
        <div className={styles.formGrid}>
          <Input
            label="Nome completo"
            required
            value={form.name}
            placeholder="Ex.: Marina Vieira"
            onChange={(e) => updateName(e.target.value)}
          />
          <Input
            label="E-mail"
            required
            type="email"
            value={form.email}
            placeholder="autor@muusic.com.br"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className={editorStyles.coverField}>
          <label className={editorStyles.fieldLabel}>Avatar</label>
          <div className={styles.authorAvatarUploader}>
            <BlogImageUploader
              value={form.avatarUrl}
              onChange={(url) => setForm({ ...form, avatarUrl: url })}
              hint="Quadrado, recomendado 256×256."
              aspectRatio="1/1"
            />
          </div>
        </div>
        <Textarea
          label="Mini bio"
          rows={3}
          value={form.bio}
          placeholder="Aparece no rodapé do post (Sobre o autor). Limite recomendado: 280 caracteres."
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <Input
          label="Slug"
          required
          value={form.slug}
          placeholder="ex-marina-vieira"
          helperText={`URL pública: /blog/autor/${form.slug || '...'}`}
          onChange={(e) => updateSlug(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
