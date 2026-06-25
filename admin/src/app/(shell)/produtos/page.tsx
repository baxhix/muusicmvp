'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import EmptyState from '@/components/ui/EmptyState';
import { IconPlus, IconEdit, IconTrash, IconAlert, IconVideo } from '@/components/icons';
import {
  productService,
  PRODUCT_AUDIENCE_LABEL,
  type Product,
} from '@/services/produtos';
import styles from './page.module.css';

/**
 * /admin/produtos — listagem dos produtos da Loja Fanverse.
 *
 * O cadastro/edição vivem em páginas dedicadas (/produtos/novo e
 * /produtos/[id]/editar), não em modal — cada produto tem upload de
 * imagens/vídeos + reordenação de galeria, que pedem a área inteira.
 */

function fmtFP(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toLocaleString('pt-BR')} FP`;
}

export default function ProdutosAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
            onClick={() => router.push('/produtos/novo')}
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
              {items.map((p) => {
                const cover = p.media[0];
                return (
                  <div key={p.id} className={styles.row}>
                    <div className={styles.thumb}>
                      {cover ? (
                        cover.type === 'video' ? (
                          <>
                            <video src={cover.url} muted playsInline preload="metadata" />
                            <span className={styles.thumbVideoTag} aria-hidden="true">
                              <IconVideo size={12} />
                            </span>
                          </>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover.url} alt="" />
                        )
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
                        {p.media.length > 0 && (
                          <span className={styles.mediaCount}>
                            {p.media.length} {p.media.length === 1 ? 'mídia' : 'mídias'}
                          </span>
                        )}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => router.push(`/produtos/${p.id}/editar`)}
                        aria-label="Editar"
                        title="Editar"
                      >
                        <IconEdit size={14} />
                      </Button>
                      <Button
                        variant="dangerGhost"
                        size="sm"
                        iconOnly
                        onClick={() => setDeleteTarget(p)}
                        aria-label="Apagar"
                        title="Apagar"
                      >
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

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
