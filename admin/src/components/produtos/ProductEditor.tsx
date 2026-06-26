'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Reorder } from 'motion/react';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Switch from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import {
  IconCheck,
  IconChevronLeft,
  IconAlert,
  IconTrash,
  IconImage,
  IconVideo,
  IconUpload,
} from '@/components/icons';
import {
  productService,
  productCategoryService,
  uploadProductMediaXHR,
  PRODUCT_AUDIENCE_OPTIONS,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_VIDEO_MAX_BYTES,
  type ProductAudience,
  type ProductMedia,
  type ProductCategory,
} from '@/services/produtos';
// Mesmo painel de upload usado em Materiais (fila + progresso + cancelar).
import FloatingUploadPanel, {
  type UploadItem,
} from '@/app/(shell)/materiais/FloatingUploadPanel';
import styles from './ProductEditor.module.css';

/**
 * ProductEditor — formulário de criação/edição de produto da Loja
 * Fanverse em PÁGINA DEDICADA (não modal). O cadastro tem upload de
 * imagens E vídeos numa galeria que pode ser reordenada (drag) —
 * a ordem é a sequência que o usuário vê na loja (1º item = capa).
 *
 *   /produtos/novo            → <ProductEditor mode="create" />
 *   /produtos/[id]/editar     → <ProductEditor mode="edit" productId={id} />
 */

export interface ProductEditorProps {
  mode: 'create' | 'edit';
  productId?: string;
}

/** Cada item da galeria ganha um id local estável p/ key + reorder. */
interface MediaItem extends ProductMedia {
  key: string;
}

let mediaKeySeq = 0;
function toMediaItems(media: ProductMedia[]): MediaItem[] {
  return media.map((m) => ({ ...m, key: `m${mediaKeySeq++}` }));
}

export default function ProductEditor({ mode, productId }: ProductEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // "Copiar registro": /produtos/novo?from=<id> pré-preenche o form.
  const duplicateFromId = mode === 'create' ? searchParams.get('from') : null;
  const { push } = useToast();

  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [quantityAvailable, setQuantityAvailable] = useState('');
  const [audience, setAudience] = useState<ProductAudience>('all');
  const [active, setActive] = useState(true);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  // Fila de upload (mesmo modelo de Materiais): itens com progresso real
  // (XHR), até 3 simultâneos. Ao concluir, o item entra na galeria.
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const queueRef = useRef<UploadItem[]>([]);
  const abortRef = useRef<Map<string, AbortController>>(new Map());
  const activeRef = useRef(0);
  const uploadKeySeq = useRef(0);
  const uploading = queue.some(
    (it) => it.status === 'pending' || it.status === 'uploading',
  );
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Categorias disponíveis (p/ o select). Carregadas nos dois modos.
  useEffect(() => {
    let alive = true;
    productCategoryService
      .list()
      .then(({ items }) => {
        if (alive) setCategories(items);
      })
      .catch((err) => console.error('categorias load failed:', err));
    return () => {
      alive = false;
    };
  }, []);

  // Hidrata o form no modo edição. Não há GET por id — busca na lista
  // e encontra o produto (escala de admin, ok).
  useEffect(() => {
    if (mode !== 'edit' || !productId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { items } = await productService.list();
        const p = items.find((i) => i.id === productId);
        if (!alive) return;
        if (!p) {
          setLoadError('Produto não encontrado.');
          return;
        }
        setName(p.name);
        setDescription(p.description ?? '');
        setPriceFrom(p.priceFrom != null ? String(p.priceFrom) : '');
        setPriceTo(String(p.priceTo));
        setQuantityAvailable(
          p.quantityAvailable != null ? String(p.quantityAvailable) : '',
        );
        setAudience(p.audience);
        setActive(p.active);
        setCategoryId(p.categoryId ?? '');
        setMedia(toMediaItems(p.media));
      } catch (err) {
        console.error('produto load failed:', err);
        if (alive) setLoadError('Não foi possível carregar o produto.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, productId]);

  // "Copiar registro": pré-preenche o form de criação a partir de um
  // produto existente (name ganha " (cópia)"). Salvar cria um NOVO.
  useEffect(() => {
    if (mode !== 'create' || !duplicateFromId) return;
    let alive = true;
    (async () => {
      try {
        const { items } = await productService.list();
        const p = items.find((i) => i.id === duplicateFromId);
        if (!alive || !p) return;
        setName(`${p.name} (cópia)`);
        setDescription(p.description ?? '');
        setPriceFrom(p.priceFrom != null ? String(p.priceFrom) : '');
        setPriceTo(String(p.priceTo));
        setQuantityAvailable(
          p.quantityAvailable != null ? String(p.quantityAvailable) : '',
        );
        setAudience(p.audience);
        setActive(p.active);
        setCategoryId(p.categoryId ?? '');
        setMedia(toMediaItems(p.media));
      } catch (err) {
        console.error('produto duplicate load failed:', err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, duplicateFromId]);

  /* ── Fila de upload (mesmo comportamento de Materiais) ──────────
   * queueRef é atualizado de forma SÍNCRONA pra o worker pool não
   * repicar o mesmo item antes do setState comitar. Até 3 uploads
   * simultâneos; ao concluir, a mídia entra na galeria reordenável. */
  const MAX_CONCURRENT = 3;

  function writeQueue(updater: (q: UploadItem[]) => UploadItem[]) {
    const next = updater(queueRef.current);
    queueRef.current = next;
    setQueue(next);
  }

  async function runUpload(key: string, file: File) {
    const ctrl = new AbortController();
    abortRef.current.set(key, ctrl);
    try {
      const m = await uploadProductMediaXHR(file, {
        signal: ctrl.signal,
        onProgress: (p) =>
          writeQueue((q) =>
            q.map((it) => (it.key === key ? { ...it, progress: p } : it)),
          ),
      });
      setMedia((cur) => [...cur, { ...m, key: `m${mediaKeySeq++}` }]);
      writeQueue((q) =>
        q.map((it) =>
          it.key === key ? { ...it, status: 'done', progress: 100 } : it,
        ),
      );
    } catch (err) {
      const code = err instanceof Error ? err.message : 'upload_failed';
      const aborted = code === 'aborted';
      writeQueue((q) =>
        q.map((it) =>
          it.key === key
            ? {
                ...it,
                status: aborted ? 'cancelled' : 'error',
                message: aborted ? undefined : humanUploadError(code),
              }
            : it,
        ),
      );
    } finally {
      abortRef.current.delete(key);
      activeRef.current = Math.max(0, activeRef.current - 1);
      pumpQueue();
    }
  }

  function pumpQueue() {
    while (activeRef.current < MAX_CONCURRENT) {
      const next = queueRef.current.find((it) => it.status === 'pending');
      if (!next) break;
      activeRef.current += 1;
      writeQueue((q) =>
        q.map((it) =>
          it.key === next.key ? { ...it, status: 'uploading', progress: 0 } : it,
        ),
      );
      void runUpload(next.key, next.file);
    }
  }

  function enqueueFiles(files: File[]) {
    if (files.length === 0) return;
    const items: UploadItem[] = files.map((file) => {
      const key = `u${uploadKeySeq.current++}`;
      const err = validateProductFile(file);
      return {
        key,
        file,
        status: err ? 'invalid' : 'pending',
        progress: 0,
        message: err ?? undefined,
      };
    });
    writeQueue((q) => [...q, ...items]);
    pumpQueue();
  }

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    enqueueFiles(files);
  };

  const cancelUpload = (key: string) => {
    abortRef.current.get(key)?.abort();
    writeQueue((q) =>
      q.map((it) =>
        it.key === key && it.status === 'pending'
          ? { ...it, status: 'cancelled' }
          : it,
      ),
    );
  };
  const cancelAllUploads = () => {
    abortRef.current.forEach((c) => c.abort());
    writeQueue((q) =>
      q.map((it) => (it.status === 'pending' ? { ...it, status: 'cancelled' } : it)),
    );
  };
  const dismissUpload = (key: string) =>
    writeQueue((q) => q.filter((it) => it.key !== key));
  const clearFinishedUploads = () =>
    writeQueue((q) =>
      q.filter((it) => it.status === 'pending' || it.status === 'uploading'),
    );

  const removeMedia = useCallback((key: string) => {
    setMedia((cur) => cur.filter((m) => m.key !== key));
  }, []);

  // Opções do select: "Sem categoria" + categorias ativas. Se a
  // categoria atual do produto estiver inativa, ainda aparece (rotulada)
  // pra não sumir silenciosamente do vínculo existente.
  const categoryOptions = useMemo(() => {
    const visible = categories.filter((c) => c.active || c.id === categoryId);
    return [
      { value: '', label: 'Sem categoria' },
      ...visible.map((c) => ({
        value: c.id,
        label: c.active ? c.name : `${c.name} (inativa)`,
      })),
    ];
  }, [categories, categoryId]);

  const canSubmit =
    name.trim().length > 0 && priceTo.trim().length > 0 && !saving && !uploading;

  const handleSave = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        priceFrom: priceFrom.trim() ? Number(priceFrom) : null,
        priceTo: Number(priceTo) || 0,
        // Estoque: vazio = ilimitado (null); número = unidades disponíveis.
        quantityAvailable: quantityAvailable.trim()
          ? Math.max(0, Math.trunc(Number(quantityAvailable)))
          : null,
        // strip a key local — o backend só quer {type, url}, na ordem atual.
        media: media.map(({ type, url }) => ({ type, url })),
        audience,
        active,
        categoryId: categoryId || null,
      };
      if (mode === 'create') {
        await productService.create(payload);
        push({ type: 'success', title: 'Produto criado' });
      } else if (productId) {
        await productService.update(productId, payload);
        push({ type: 'success', title: 'Produto atualizado' });
      }
      router.push('/produtos');
    } catch (err) {
      console.error('product save failed:', err);
      push({ type: 'error', title: 'Não foi possível salvar', description: 'Tente de novo.' });
    } finally {
      setSaving(false);
    }
  }, [
    canSubmit, name, description, priceFrom, priceTo, quantityAvailable, media,
    audience, active, categoryId, mode, productId, push, router,
  ]);

  const pageTitle = mode === 'create' ? 'Novo produto' : 'Editar produto';

  if (loadError) {
    return (
      <>
        <PageHeader
          title={pageTitle}
          actions={
            <Button variant="ghost" size="sm" leadingIcon={<IconChevronLeft size={14} />} onClick={() => router.push('/produtos')}>
              Voltar
            </Button>
          }
        />
        <div className={styles.body}>
          <Card>
            <CardBody>
              <div className={styles.errorBanner}>
                <IconAlert size={14} /> {loadError}
              </div>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={pageTitle}
        description={
          mode === 'create'
            ? 'Cadastro completo: dados, mídia (imagens e vídeos) e quem pode comprar.'
            : 'Edite os dados, reordene a mídia (arraste) e salve.'
        }
        actions={
          <div className={styles.headerActions}>
            <Button variant="ghost" size="sm" leadingIcon={<IconChevronLeft size={14} />} onClick={() => router.push('/produtos')} disabled={saving}>
              Voltar
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!canSubmit}
              loading={saving}
              leadingIcon={!saving ? <IconCheck size={14} /> : undefined}
              onClick={() => void handleSave()}
            >
              {mode === 'create' ? 'Criar produto' : 'Salvar'}
            </Button>
          </div>
        }
      />

      <div className={styles.body}>
        {loading ? (
          <Card>
            <div className={styles.loading}>Carregando…</div>
          </Card>
        ) : (
          <div className={styles.layout}>
            {/* ── Dados ───────────────────────────────────────── */}
            <Card>
              <CardHeader title="Dados do produto" />
              <CardBody className={styles.formBody}>
                <Input
                  label="Nome"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                  placeholder="Ex: Chapéu Ana Castela — Couro Preto"
                  disabled={saving}
                />

                <Textarea
                  label="Descrição"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={5000}
                  rows={4}
                  placeholder="Detalhes do produto"
                  disabled={saving}
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
                    disabled={saving}
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
                    disabled={saving}
                  />
                </div>

                <Input
                  label="Quantidade disponível"
                  type="number"
                  min={0}
                  step={1}
                  value={quantityAvailable}
                  onChange={(e) => setQuantityAvailable(e.target.value)}
                  placeholder="Ilimitado"
                  helperText="Estoque do produto. Deixe em branco para ilimitado; 0 = esgotado."
                  disabled={saving}
                />

                <Select
                  label="Categoria"
                  options={categoryOptions}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  helperText="Agrupa o produto na loja. Gerencie em Produtos → Categorias."
                  disabled={saving}
                />

                <Select
                  label="Quem pode comprar"
                  options={PRODUCT_AUDIENCE_OPTIONS}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as ProductAudience)}
                  helperText="Restringe a compra por tier de fãs."
                  disabled={saving}
                />

                <div className={styles.activeToggle}>
                  <span>
                    {active ? 'Disponível na loja' : 'Inativo'}
                    <em>
                      {active
                        ? 'Aparece na Loja Fanverse para o público selecionado.'
                        : 'Fica salvo aqui mas não aparece na loja.'}
                    </em>
                  </span>
                  <Switch checked={active} onChange={(e) => setActive(e.target.checked)} disabled={saving} aria-label="Disponível" />
                </div>
              </CardBody>
            </Card>

            {/* ── Mídia ───────────────────────────────────────── */}
            <Card>
              <CardHeader
                title="Mídia"
                description="Imagens e vídeos. Arraste para reordenar — a ordem é a sequência que o usuário vê (1º item = capa)."
                actions={
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<IconUpload size={14} />}
                    onClick={() => fileRef.current?.click()}
                    loading={uploading}
                    disabled={uploading || saving}
                  >
                    {uploading ? 'Enviando…' : 'Adicionar mídia'}
                  </Button>
                }
              />
              <CardBody className={styles.mediaBody}>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    enqueueFiles(Array.from(e.dataTransfer.files));
                  }}
                >
                {media.length === 0 ? (
                <button
                  type="button"
                  className={styles.dropzone}
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || saving}
                >
                  <IconUpload size={20} />
                  <strong>Adicionar imagens e vídeos</strong>
                  <span>JPG, PNG, WebP, GIF (até 8 MB) · MP4, WebM, MOV (até 100 MB)</span>
                </button>
              ) : (
                <Reorder.Group
                  axis="x"
                  values={media}
                  onReorder={setMedia}
                  className={styles.mediaGrid}
                >
                  {media.map((m, i) => (
                    <Reorder.Item
                      key={m.key}
                      value={m}
                      className={styles.mediaItem}
                      whileDrag={{ scale: 1.04, zIndex: 2 }}
                    >
                      <div className={styles.mediaThumb}>
                        {m.type === 'video' ? (
                          <>
                            <video src={m.url} muted playsInline preload="metadata" />
                            <span className={styles.typeTag}>
                              <IconVideo size={11} /> Vídeo
                            </span>
                          </>
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="" />
                            <span className={styles.typeTag}>
                              <IconImage size={11} /> Foto
                            </span>
                          </>
                        )}
                        {i === 0 && <span className={styles.coverTag}>Capa</span>}
                        <button
                          type="button"
                          className={styles.mediaRemove}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => removeMedia(m.key)}
                          aria-label="Remover mídia"
                          title="Remover"
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/ogg"
                  multiple
                  onChange={onPickFiles}
                  style={{ display: 'none' }}
                />
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* Mesmo painel de upload de Materiais (canto inferior-direito):
       *  fila + progresso real + cancelar. */}
      <FloatingUploadPanel
        items={queue}
        onCancelItem={cancelUpload}
        onCancelAll={cancelAllUploads}
        onDismissItem={dismissUpload}
        onClearFinished={clearFinishedUploads}
      />
    </>
  );
}

/** Valida um arquivo de produto antes do upload (espelha limites do
 *  backend). Retorna mensagem PT-BR ou null se válido. */
function validateProductFile(file: File): string | null {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) return 'Formato não suportado (use imagem ou vídeo).';
  const max = isVideo ? PRODUCT_VIDEO_MAX_BYTES : PRODUCT_IMAGE_MAX_BYTES;
  if (file.size > max) {
    return `Arquivo muito grande (limite ${isVideo ? '100 MB' : '8 MB'}).`;
  }
  return null;
}

function humanUploadError(code: string): string {
  switch (code) {
    case 'too_large':
      return 'Arquivo muito grande.';
    case 'unsupported_type':
      return 'Formato não suportado.';
    case 'no_file':
      return 'Nenhum arquivo recebido.';
    case 'network_error':
      return 'Falha de rede. Tente de novo.';
    default:
      return 'Tente novamente.';
  }
}
