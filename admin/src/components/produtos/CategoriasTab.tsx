'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Switch from '@/components/ui/Switch';
import Textarea from '@/components/ui/Textarea';
import Table, { type Column } from '@/components/ui/Table';
import Dialog, { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { IconCheck, IconEdit, IconPlus, IconSearch, IconTrash } from '@/components/icons';
import { productCategoryService, type ProductCategory } from '@/services/produtos';
import { formatRelative } from '@/lib/format';
import styles from '@/app/(shell)/produtos/page.module.css';

/**
 * CategoriasTab — CRUD das categorias de produto.
 *
 * Espelha a aba de Categorias do blog (Table + Dialog), mas fala com
 * o backend real (/api/admin/produtos/categorias). Categoria = nome +
 * descrição + status (ativa/inativa). Apagar uma categoria desvincula
 * os produtos (SET NULL no backend), não os apaga.
 */

interface CategoryDraft {
  id: string | null;
  name: string;
  description: string;
  active: boolean;
}

function newDraft(): CategoryDraft {
  return { id: null, name: '', description: '', active: true };
}

export default function CategoriasTab() {
  const { push } = useToast();
  const [rows, setRows] = useState<ProductCategory[] | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CategoryDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const { items } = await productCategoryService.list();
    setRows(items);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((c) => {
      if (!q) return true;
      const hay = [c.name, c.description ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  function openEdit(c: ProductCategory) {
    setEditing({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      active: c.active,
    });
  }

  async function saveDraft(draft: CategoryDraft) {
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        active: draft.active,
      };
      if (draft.id) {
        await productCategoryService.update(draft.id, payload);
        push({ type: 'success', title: 'Categoria atualizada', description: `"${payload.name}" salva.` });
      } else {
        await productCategoryService.create(payload);
        push({ type: 'success', title: 'Categoria criada', description: `"${payload.name}" disponível.` });
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
    try {
      await productCategoryService.remove(pendingDelete.id);
      push({ type: 'warning', title: 'Categoria removida', description: `"${pendingDelete.name}" foi excluída.` });
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      console.error('categoria delete failed:', err);
      push({ type: 'error', title: 'Erro ao remover' });
    }
  }

  const columns: Column<ProductCategory>[] = [
    {
      id: 'name',
      header: 'Categoria',
      sortKey: (c) => c.name,
      cell: (c) => (
        <div className={styles.cellName}>
          <span className={styles.cellPrimary}>{c.name}</span>
          <span className={styles.cellSecondary}>{c.description || '—'}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortKey: (c) => (c.active ? 1 : 0),
      cell: (c) => (
        <Badge tone={c.active ? 'success' : 'neutral'} size="sm" dot>
          {c.active ? 'Ativa' : 'Inativa'}
        </Badge>
      ),
      width: 110,
    },
    {
      id: 'updatedAt',
      header: 'Atualizada',
      sortKey: (c) => c.updatedAt,
      cell: (c) => <span className={styles.muteCell}>{formatRelative(c.updatedAt)}</span>,
      width: 150,
    },
    {
      id: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (c) => (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" iconOnly aria-label={`Editar ${c.name}`} title="Editar" onClick={() => openEdit(c)}>
            <IconEdit size={14} />
          </Button>
          <Button variant="dangerGhost" size="sm" iconOnly aria-label={`Remover ${c.name}`} title="Remover" onClick={() => setPendingDelete(c)}>
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
          description="Agrupam os produtos da Loja Fanverse. Cada produto pode ter uma categoria."
          actions={
            <Button variant="primary" size="sm" leadingIcon={<IconPlus size={14} />} onClick={() => setEditing(newDraft())}>
              Nova categoria
            </Button>
          }
        />
      </Card>

      <Card className={styles.filters2}>
        <Input
          inputSize="md"
          placeholder="Buscar por nome ou descrição…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
      </Card>

      <Card className={styles.tableCard}>
        <Table<ProductCategory>
          columns={columns}
          data={filtered}
          rowId={(c) => c.id}
          pageSize={20}
          loading={rows === null}
        />
      </Card>

      <CategoryDialog draft={editing} saving={saving} onCancel={() => setEditing(null)} onSave={saveDraft} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete ? `Remover "${pendingDelete.name}"?` : ''}
        description="A categoria é excluída. Produtos vinculados não são apagados — apenas ficam sem categoria."
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

  const valid = form.name.trim().length >= 2;
  const isCreating = form.id === null;

  return (
    <Dialog
      open={draft !== null}
      onClose={onCancel}
      title={isCreating ? 'Nova categoria' : `Editar — ${draft?.name}`}
      description="Categorias organizam o catálogo de produtos da loja."
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
      <div className={styles.dialogForm}>
        <Input
          label="Nome"
          required
          value={form.name}
          placeholder="Ex.: Vestuário"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Textarea
          label="Descrição"
          rows={2}
          value={form.description}
          placeholder="Resumo curto da categoria (opcional)."
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className={styles.dialogToggle}>
          <span>
            {form.active ? 'Ativa' : 'Inativa'}
            <em>{form.active ? 'Disponível para uso no cadastro de produto.' : 'Some das opções de categoria.'}</em>
          </span>
          <Switch
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            aria-label="Ativa"
          />
        </div>
      </div>
    </Dialog>
  );
}
