'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import {
  IconDownload,
  IconTrash,
  IconFeed,
  IconHeart,
  IconEdit,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from '@/components/icons';
import type { MaterialFile, MaterialStatus } from '@/types/materiais';
import { MATERIAL_STATUS_LABEL } from '@/lib/materiais';
import { formatNumber, formatDateLong } from '@/lib/format';
import { formatBytes } from './shared';
import styles from './MaterialPreviewModal.module.css';

const STATUS_TONE: Record<MaterialStatus, BadgeTone> = {
  rascunho:  'neutral',
  publicado: 'success',
  agendado:  'info',
  arquivado: 'warning',
};

export interface MaterialPreviewModalProps {
  /** Arquivo atualmente selecionado. null = modal fechado. */
  file: MaterialFile | null;
  /** Lista de arquivos da pasta atual — pra navegar com setas. */
  files: MaterialFile[];
  onClose: () => void;
  onDownload: (file: MaterialFile) => void;
  onDelete: (file: MaterialFile) => void;
  onRename: (file: MaterialFile) => void;
  /** Callback pra trocar o arquivo atual (prev/next). */
  onSelect: (file: MaterialFile) => void;
}

/**
 * Modal de preview de arquivo — substitui o drawer lateral por uma
 * experiência fullscreen tipo lightbox. Permite navegação entre
 * arquivos via:
 *   - Setas laterais (clique)
 *   - Teclas ← / → (keyboard)
 *   - Esc fecha
 *
 * Layout: imagem grande à esquerda, sidebar de metadados à direita.
 * Reaproveita as mesmas informações que o drawer mostrava.
 */
export default function MaterialPreviewModal({
  file,
  files,
  onClose,
  onDownload,
  onDelete,
  onRename,
  onSelect,
}: MaterialPreviewModalProps) {
  /* Index do arquivo atual na lista — usado pra calcular prev/next.
   * useMemo evita recomputo a cada render quando file/files
   * estáveis. -1 se o arquivo não estiver na lista (edge case). */
  const currentIndex = useMemo(
    () => (file ? files.findIndex((f) => f.id === file.id) : -1),
    [file, files],
  );

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < files.length - 1;

  const goPrev = () => {
    if (hasPrev) onSelect(files[currentIndex - 1]);
  };
  const goNext = () => {
    if (hasNext) onSelect(files[currentIndex + 1]);
  };

  /* Keyboard nav — Esc fecha, ← / → navegam. Listener só ativo
   * enquanto o modal está aberto. Body overflow trancado pra
   * evitar scroll do fundo. */
  useEffect(() => {
    if (!file) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && hasPrev) goPrev();
      else if (e.key === 'ArrowRight' && hasNext) goNext();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, hasPrev, hasNext, currentIndex]);

  if (!file || typeof window === 'undefined') return null;

  const isImage = ['jpg', 'png', 'svg'].includes(file.formato);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      {/* Setas laterais — posicionadas absolute no backdrop pra
       *  ficarem fora do panel central. Hidden quando sem prev/next. */}
      {hasPrev && (
        <button
          type="button"
          className={`${styles.navArrow} ${styles.navArrowLeft}`}
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Arquivo anterior"
          title="Anterior (←)"
        >
          <IconChevronLeft size={22} />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          className={`${styles.navArrow} ${styles.navArrowRight}`}
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Próximo arquivo"
          title="Próximo (→)"
        >
          <IconChevronRight size={22} />
        </button>
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-preview-title"
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — top right do panel inteiro. */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fechar preview"
          title="Fechar (Esc)"
        >
          <IconX size={18} />
        </button>

        {/* ── Esquerda: Preview ────────────────────────── */}
        <div className={styles.previewArea}>
          {isImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={file.thumb}
              alt={file.name}
              className={styles.previewImg}
            />
          ) : (
            <div className={styles.previewPlaceholder}>
              <div className={styles.placeholderFormat}>
                {file.formato.toUpperCase()}
              </div>
              <div className={styles.placeholderHint}>
                Visualização indisponível pra este formato.
              </div>
            </div>
          )}
          {/* Counter pra contexto de navegação (X de N). */}
          {files.length > 1 && currentIndex >= 0 && (
            <div className={styles.counter}>
              {currentIndex + 1} <span>/</span> {files.length}
            </div>
          )}
        </div>

        {/* ── Direita: Sidebar de metadados ───────────── */}
        <aside className={styles.sidebar}>
          <header className={styles.sidebarHeader}>
            <h2 id="material-preview-title" className={styles.title}>
              {file.name}
            </h2>
            {file.description && (
              <p className={styles.description}>{file.description}</p>
            )}
          </header>

          <div className={styles.sidebarBody}>
            {/* Status + flags */}
            <div className={styles.statusRow}>
              <Badge tone={STATUS_TONE[file.status]} size="sm" dot>
                {MATERIAL_STATUS_LABEL[file.status]}
              </Badge>
              {file.publishedToFeed && (
                <span className={styles.feedFlag} title="Também publicado no feed">
                  <IconFeed size={11} /> Publicado no feed
                </span>
              )}
            </div>

            {/* Metadados em grid */}
            <dl className={styles.meta}>
              <div className={styles.metaItem}>
                <dt>Formato</dt>
                <dd>{file.formato.toUpperCase()}</dd>
              </div>
              <div className={styles.metaItem}>
                <dt>Tamanho</dt>
                <dd>{formatBytes(file.tamanhoBytes)}</dd>
              </div>
              <div className={styles.metaItem}>
                <dt>Downloads</dt>
                <dd>{formatNumber(file.downloads)}</dd>
              </div>
              <div className={styles.metaItem}>
                <dt>Favoritos</dt>
                <dd>
                  <IconHeart size={12} /> {formatNumber(file.favoritos)}
                </dd>
              </div>
              <div className={styles.metaItem}>
                <dt>Publicado em</dt>
                <dd>{formatDateLong(file.publicadoEm)}</dd>
              </div>
              <div className={styles.metaItem}>
                <dt>Por</dt>
                <dd>{file.createdBy?.name ?? '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Footer com CTAs — sticky bottom da sidebar. */}
          <footer className={styles.sidebarFooter}>
            <Button
              variant="ghost"
              size="md"
              leadingIcon={<IconEdit size={14} />}
              onClick={() => onRename(file)}
            >
              Renomear
            </Button>
            <Button
              variant="primary"
              size="md"
              leadingIcon={<IconDownload size={14} />}
              onClick={() => onDownload(file)}
            >
              Download
            </Button>
            <Button
              variant="danger"
              size="md"
              leadingIcon={<IconTrash size={14} />}
              onClick={() => onDelete(file)}
            >
              Excluir
            </Button>
          </footer>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
