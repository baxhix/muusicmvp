'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Reorder } from 'motion/react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
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
  uploadProductMedia,
  PRODUCT_AUDIENCE_OPTIONS,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_VIDEO_MAX_BYTES,
  type ProductAudience,
  type ProductMedia,
} from '@/services/produtos';
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
  const { push } = useToast();

  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [audience, setAudience] = useState<ProductAudience>('all');
  const [active, setActive] = useState(true);
  const [media, setMedia] = useState<MediaItem[]>([]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
        setAudience(p.audience);
        setActive(p.active);
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

  const onPickFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (files.length === 0) return;
      setUploading(true);
      try {
        for (const file of files) {
          const isImage = file.type.startsWith('image/');
          const isVideo = file.type.startsWith('video/');
          if (!isImage && !isVideo) {
            push({ type: 'error', title: 'Arquivo não suportado', description: `${file.name} não é imagem nem vídeo.` });
            continue;
          }
          const max = isVideo ? PRODUCT_VIDEO_MAX_BYTES : PRODUCT_IMAGE_MAX_BYTES;
          if (file.size > max) {
            push({
              type: 'error',
              title: 'Arquivo muito grande',
              description: `${file.name} excede o limite (${isVideo ? '100 MB' : '8 MB'}).`,
            });
            continue;
          }
          try {
            const m = await uploadProductMedia(file);
            setMedia((cur) => [...cur, { ...m, key: `m${mediaKeySeq++}` }]);
          } catch (err) {
            const code = err instanceof Error ? err.message : 'upload_failed';
            push({ type: 'error', title: 'Falha no upload', description: humanUploadError(code) });
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [push],
  );

  const removeMedia = useCallback((key: string) => {
    setMedia((cur) => cur.filter((m) => m.key !== key));
  }, []);

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
        // strip a key local — o backend só quer {type, url}, na ordem atual.
        media: media.map(({ type, url }) => ({ type, url })),
        audience,
        active,
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
    canSubmit, name, description, priceFrom, priceTo, media, audience, active,
    mode, productId, push, router,
  ]);

  const pageTitle = mode === 'create' ? 'Novo produto' : 'Editar produto';

  if (loadError) {
    return (
      <div className={styles.page}>
        <PageHeader
          title={pageTitle}
          actions={
            <Button variant="ghost" size="sm" leadingIcon={<IconChevronLeft size={14} />} onClick={() => router.push('/produtos')}>
              Voltar
            </Button>
          }
        />
        <Card>
          <div className={styles.errorBanner}>
            <IconAlert size={14} /> {loadError}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.page}>
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

      {loading ? (
        <Card>
          <div className={styles.loading}>Carregando…</div>
        </Card>
      ) : (
        <div className={styles.layout}>
          {/* ── Dados ───────────────────────────────────────── */}
          <Card>
            <div className={styles.formBody}>
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
            </div>
          </Card>

          {/* ── Mídia ───────────────────────────────────────── */}
          <Card>
            <div className={styles.mediaBlock}>
              <div className={styles.mediaHead}>
                <div>
                  <span className={styles.mediaTitle}>Mídia</span>
                  <span className={styles.mediaHint}>
                    Imagens e vídeos. Arraste para reordenar — a ordem é a sequência que o usuário vê (1º item = capa).
                  </span>
                </div>
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
              </div>

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

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/ogg"
                multiple
                onChange={onPickFiles}
                style={{ display: 'none' }}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function humanUploadError(code: string): string {
  switch (code) {
    case 'too_large':
      return 'Arquivo muito grande.';
    case 'unsupported_type':
      return 'Formato não suportado.';
    case 'no_file':
      return 'Nenhum arquivo recebido.';
    default:
      return 'Tente novamente.';
  }
}
