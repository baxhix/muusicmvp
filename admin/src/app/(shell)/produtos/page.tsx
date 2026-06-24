'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Switch from '@/components/ui/Switch';
import Dialog, { ConfirmDialog } from '@/components/ui/Dialog';
import EmptyState from '@/components/ui/EmptyState';
import { IconPlus, IconEdit, IconTrash, IconAlert } from '@/components/icons';
import {
  productService,
  uploadProductImage,
  PRODUCT_AUDIENCE_OPTIONS,
  PRODUCT_AUDIENCE_LABEL,
  type Product,
  type ProductAudience,
} from '@/services/produtos';
import styles from './page.module.css';

/**
 * /admin/produtos — CRUD dos produtos da Loja Fanverse.
 *
 * Cada produto tem nome, descrição, preço "de"/"por" (em Fanpoints),
 * imagens (upload) e o público que pode comprar (tiers de fãs).
 */

function fmtFP(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toLocaleString('pt-BR')} FP`;
}

export default function ProdutosAdminPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { items: rows } = await productService.list();
      setItems(rows);
    } catch (err) {
      console.error('produtos load failed:', err);
      setLoadError('Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await productService.remove(deleteTarget.id);
      setItems((cur) => cur.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('produto delete failed:', err);
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTarget]);

  const handleSaved = useCallback((product: Product, isNew: boolean) => {
    setItems((cur) =>
      isNew ? [product, ...cur] : cur.map((i) => (i.id === product.id ? product : i)),
    );
    setEditing(null);
    setCreating(false);
  }, []);

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Catálogo de produtos resgatáveis na Loja Fanverse (preços em Fanpoints)."
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            onClick={() => setCreating(true)}
          >
            Novo produto
          </Button>
        }
      />
      <div className={styles.body}>
        {loadError && (
          <div className={styles.errorBanner}>
            <IconAlert size={14} /> {loadError}
          </div>
        )}

        <Card>
          {loading ? (
            <div className={styles.loading}>Carregando…</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<IconAlert />}
              title="Nenhum produto cadastrado"
              description="Crie o primeiro produto clicando em 'Novo produto' no canto superior direito."
            />
          ) : (
            <div className={styles.list}>
              {items.map((p) => (
                <div key={p.id} className={styles.row}>
                  <div className={styles.thumb}>
                    {p.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrls[0]} alt="" />
                    ) : (
                      <span className={styles.thumbEmpty} aria-hidden="true" />
                    )}
                  </div>

                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{p.name}</div>
                    <div className={styles.rowMeta}>
                      {p.priceFrom != null && p.priceFrom > p.priceTo && (
                        <span className={styles.priceFrom}>{fmtFP(p.priceFrom)}</span>
                      )}
                      <span className={styles.priceTo}>{fmtFP(p.priceTo)}</span>
                      <span className={styles.dot}>·</span>
                      <span className={styles.audienceBadge}>
                        {PRODUCT_AUDIENCE_LABEL[p.audience]}
                      </span>
                      <span
                        className={`${styles.statusBadge} ${
                          p.active ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {p.active ? 'Disponível' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.rowActions}>
                    <Button variant="ghost" size="sm" iconOnly onClick={() => setEditing(p)} aria-label="Editar" title="Editar">
                      <IconEdit size={14} />
                    </Button>
                    <Button variant="dangerGhost" size="sm" iconOnly onClick={() => setDeleteTarget(p)} aria-label="Apagar" title="Apagar">
                      <IconTrash size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {(creating || editing) && (
        <ProductFormDialog
          product={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Apagar produto?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" será removido permanentemente. Essa ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Apagar"
        destructive
        loading={deleteSubmitting}
      />
    </>
  );
}

/* ── Create / Edit dialog ───────────────────────────────── */
interface ProductFormDialogProps {
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product, isNew: boolean) => void;
}

function ProductFormDialog({ product, onClose, onSaved }: ProductFormDialogProps) {
  const isNew = product === null;
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [priceFrom, setPriceFrom] = useState(
    product?.priceFrom != null ? String(product.priceFrom) : '',
  );
  const [priceTo, setPriceTo] = useState(
    product?.priceTo != null ? String(product.priceTo) : '',
  );
  const [audience, setAudience] = useState<ProductAudience>(product?.audience ?? 'all');
  const [active, setActive] = useState(product?.active ?? true);
  const [imageUrls, setImageUrls] = useState<string[]>(product?.imageUrls ?? []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    name.trim().length > 0 && priceTo.trim().length > 0 && !submitting && !uploading;

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          setError('Imagem muito grande (máx 5 MB).');
          continue;
        }
        const url = await uploadProductImage(file);
        setImageUrls((cur) => [...cur, url]);
      }
    } catch (err) {
      console.error('product image upload failed:', err);
      setError('Falha no upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) =>
    setImageUrls((cur) => cur.filter((u) => u !== url));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        priceFrom: priceFrom.trim() ? Number(priceFrom) : null,
        priceTo: Number(priceTo) || 0,
        imageUrls,
        audience,
        active,
      };
      const res = isNew
        ? await productService.create(payload)
        : await productService.update(product!.id, payload);
      onSaved(res.product, isNew);
    } catch (err) {
      console.error('product save failed:', err);
      setError('Não foi possível salvar. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={submitting ? () => {} : onClose}
      title={isNew ? 'Novo produto' : 'Editar produto'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            disabled={!canSubmit}
            loading={submitting}
          >
            {isNew ? 'Criar' : 'Salvar'}
          </Button>
        </>
      }
    >
      <form className={styles.formStack} onSubmit={handleSubmit}>
        {error && (
          <div className={styles.errorBanner}>
            <IconAlert size={14} /> {error}
          </div>
        )}

        <Input
          label="Nome"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="Ex: Chapéu Ana Castela — Couro Preto"
          disabled={submitting}
        />

        <Textarea
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={4}
          placeholder="Detalhes do produto"
          disabled={submitting}
        />

        <div className={styles.priceRow}>
          <Input
            label="Preço de (FP)"
            type="number"
            min={0}
            value={priceFrom}
            onChange={(e) => setPriceFrom(e.target.value)}
            placeholder="Opcional"
            helperText="Preço cheio (riscado)"
            disabled={submitting}
          />
          <Input
            label="Preço por (FP)"
            required
            type="number"
            min={0}
            value={priceTo}
            onChange={(e) => setPriceTo(e.target.value)}
            placeholder="0"
            helperText="Preço efetivo de resgate"
            disabled={submitting}
          />
        </div>

        <Select
          label="Quem pode comprar"
          options={PRODUCT_AUDIENCE_OPTIONS}
          value={audience}
          onChange={(e) => setAudience(e.target.value as ProductAudience)}
          helperText="Restringe a compra por tier de fãs."
          disabled={submitting}
        />

        {/* Imagens */}
        <div className={styles.imagesBlock}>
          <span className={styles.imagesLabel}>Imagens</span>
          <div className={styles.imagesGrid}>
            {imageUrls.map((url) => (
              <div key={url} className={styles.imageThumb}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" />
                <button
                  type="button"
                  className={styles.imageRemove}
                  onClick={() => removeImage(url)}
                  aria-label="Remover imagem"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.imageAdd}
              onClick={() => fileRef.current?.click()}
              disabled={uploading || submitting}
            >
              {uploading ? 'Enviando…' : '+ Imagem'}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={onPickImages}
            style={{ display: 'none' }}
          />
        </div>

        <div className={styles.activeToggle}>
          <span>
            {active ? 'Disponível na loja' : 'Inativo'}
            <em>
              {active
                ? 'Aparece na Loja Fanverse para o público selecionado.'
                : 'Fica salvo aqui mas não aparece na loja.'}
            </em>
          </span>
          <Switch
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={submitting}
            aria-label="Disponível"
          />
        </div>
      </form>
    </Dialog>
  );
}
