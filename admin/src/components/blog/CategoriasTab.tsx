'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Table, { type Column } from '@/components/ui/Table';
import Dialog, { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { IconCheck, IconEdit, IconPlus, IconSearch, IconTrash } from '@/components/icons';
import { blogCategoriesService } from '@/services/blog/categories';
import { slugify } from '@/lib/blog/slug';
import { formatRelative } from '@/lib/format';
import type { BlogCategory } from '@/types/blog';
import styles from '@/app/(shell)/blog/page.module.css';

/**
 * CategoriasTab — CRUD da listagem de categorias.
 *
 * Funcionalidades cobertas:
 *   - Busca por nome/slug/descrição
 *   - Filtro por status (active/inactive/all)
 *   - Paginação client-side (Table do design system já cuida)
 *   - Criar nova categoria via Dialog
 *   - Editar via Dialog
 *   - Deletar via ConfirmDialog
 *
 * O slug é auto-gerado do nome mas editável. Validação de
 * unicidade é feita pelo service (ensureUniqueSlug) — UI apenas
 * mostra o slug em real-time conforme o usuário digita.
 */

const STATUS_OPTIONS = [
  { value: 'all',      label: 'Todos os status' },
  { value: 'active',   label: 'Ativas' },
  { value: 'inactive', label: 'Inativas' },
];

interface CategoryDraft {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  status: 'active' | 'inactive';
  /** Se true, slug atualiza automaticamente com o nome.
   *  Vira false quando o usuário edita o slug manualmente
   *  (preservando a edição). */
  slugAuto: boolean;
}

function newDraft(): CategoryDraft {
  return { id: null, name: '', slug: '', description: '', status: 'active', slugAuto: true };
}

export default function CategoriasTab() {
  const { push } = useToast();
  const [rows, setRows] = useState<BlogCategory[] | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('all');
  const [editing, setEditing] = useState<CategoryDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BlogCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const { items } = await blogCategoriesService.list();
    setRows(items);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Filtragem em memória — o service também aceita filtros mas
  // pra UI responsiva, filtramos o cache local.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (q) {
        const hay = [c.name, c.slug, c.description ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status]);

  function openCreate() {
    setEditing(newDraft());
  }
  function openEdit(c: BlogCategory) {
    setEditing({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? '',
      status: c.status,
      slugAuto: false,
    });
  }

  async function saveDraft(draft: CategoryDraft) {
    setSaving(true);
    try {
      if (draft.id) {
        await blogCategoriesService.update(draft.id, {
          name: draft.name,
          slug: draft.slug,
          description: draft.description,
          status: draft.status,
        });
        push({
          type: 'success',
          title: 'Categoria atualizada',
          description: `"${draft.name}" salva.`,
        });
      } else {
        const created = await blogCategoriesService.create({
          name: draft.name,
          slug: draft.slug,
          description: draft.description,
          status: draft.status,
        });
        push({
          type: 'success',
          title: 'Categoria criada',
          description: `"${created.name}" disponível.`,
        });
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      console.error('categoria save failed:', err);
      push({ type: 'error', title: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await blogCategoriesService.remove(pendingDelete.id);
    push({
      type: 'warning',
      title: 'Categoria removida',
      description: `"${pendingDelete.name}" foi excluída.`,
    });
    setPendingDelete(null);
    await refresh();
  }

  const columns: Column<BlogCategory>[] = [
    {
      id: 'name',
      header: 'Categoria',
      sortKey: (c) => c.name,
      cell: (c) => (
        <div className={styles.cellName}>
          <span className={styles.cellPrimary}>{c.name}</span>
          <span className={styles.cellSecondary}>
            {c.description ?? '—'}
          </span>
        </div>
      ),
    },
    {
      id: 'slug',
      header: 'Slug',
      sortKey: (c) => c.slug,
      cell: (c) => <code className={styles.slugCode}>/{c.slug}</code>,
      width: 200,
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (c) => c.status,
      cell: (c) => (
        <Badge tone={c.status === 'active' ? 'success' : 'neutral'} size="sm" dot>
          {c.status === 'active' ? 'Ativa' : 'Inativa'}
        </Badge>
      ),
      width: 100,
    },
    {
      id: 'postCount',
      header: 'Posts',
      sortKey: (c) => c.postCount,
      align: 'right',
      cell: (c) => <span className={styles.numCell}>{c.postCount}</span>,
      width: 80,
    },
    {
      id: 'updatedAt',
      header: 'Atualizada',
      sortKey: (c) => c.updatedAt,
      cell: (c) => <span className={styles.muteCell}>{formatRelative(c.updatedAt)}</span>,
      width: 140,
    },
    {
      id: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (c) => (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={`Editar ${c.name}`}
            title="Editar"
            onClick={() => openEdit(c)}
          >
            <IconEdit size={14} />
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            aria-label={`Remover ${c.name}`}
            title="Remover"
            onClick={() => setPendingDelete(c)}
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
          title="Categorias"
          description="Agrupamento usado nas URLs públicas (/blog/categoria/[slug]) e nos filtros do leitor."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconPlus size={14} />}
              onClick={openCreate}
            >
              Nova categoria
            </Button>
          }
        />
      </Card>

      <Card className={styles.filters2}>
        <Input
          inputSize="md"
          placeholder="Buscar por nome, slug ou descrição…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'inactive')}
          options={STATUS_OPTIONS}
        />
      </Card>

      <Card className={styles.tableCard}>
        <Table<BlogCategory>
          columns={columns}
          data={filtered}
          rowId={(c) => c.id}
          pageSize={20}
          loading={rows === null}
        />
      </Card>

      <CategoryDialog
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
        description="A categoria é excluída do admin. Posts vinculados não são afetados (você precisa reatribuí-los manualmente)."
        confirmLabel="Remover"
        destructive
      />
    </div>
  );
}

function CategoryDialog({
  draft,
  saving,
  onCancel,
  onSave,
}: {
  draft: CategoryDraft | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (d: CategoryDraft) => void;
}) {
  const [form, setForm] = useState<CategoryDraft | null>(draft);

  useEffect(() => {
    setForm(draft);
  }, [draft]);

  if (!form) return null;

  // Auto-slug enquanto o flag `slugAuto` estiver ligado. Vira
  // false na primeira edição manual do slug.
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

  const valid = form.name.trim().length >= 2 && form.slug.trim().length >= 2;
  const isCreating = form.id === null;

  return (
    <Dialog
      open={draft !== null}
      onClose={onCancel}
      title={isCreating ? 'Nova categoria' : `Editar — ${draft?.name}`}
      description="Categorias estruturam o blog público e alimentam URLs amigáveis."
      size="md"
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
        <Input
          label="Nome"
          required
          value={form.name}
          placeholder="Ex.: Shows e Eventos"
          onChange={(e) => updateName(e.target.value)}
        />
        <Input
          label="Slug"
          required
          value={form.slug}
          placeholder="ex-shows-eventos"
          helperText={`URL pública: /blog/categoria/${form.slug || '...'}`}
          onChange={(e) => updateSlug(e.target.value)}
        />
        <Textarea
          label="Descrição curta"
          rows={2}
          value={form.description}
          placeholder="Aparece como resumo da categoria nas listagens públicas (opcional)."
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Select
          label="Status"
          required
          value={form.status}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value as 'active' | 'inactive' })
          }
          options={[
            { value: 'active', label: 'Ativa' },
            { value: 'inactive', label: 'Inativa (não aparece no blog público)' },
          ]}
        />
      </div>
    </Dialog>
  );
}
