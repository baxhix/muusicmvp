'use client';

import { useCallback, useRef, useState } from 'react';
import { IconImage, IconX } from '@/components/icons';
import { feedService } from '@/services/feed';
import { resolveAssetUrl } from '@/lib/utils';
import type { FeedMediaItem } from '@/types';
import styles from './FeedImageUploader.module.css';

/**
 * Multi-image uploader.
 *
 *   - Drop zone or click-to-pick (accepts multiple). Each selected
 *     file is uploaded individually to /api/admin/feed/upload; a
 *     failed file doesn't block the rest.
 *   - Tile grid renders each accepted image; hover reveals an X to
 *     remove. First tile gets the "Capa" badge — admin can drag
 *     to reorder which slide leads.
 *   - HTML5 drag-and-drop for reorder. We could pull react-dnd
 *     in, but a plain dataTransfer flow keeps the bundle lean and
 *     covers desktop + most modern mobile browsers via pointer
 *     events on the same handlers.
 *
 * Shape-agnostic: the component speaks `FeedMediaItem[]` so the
 * day video / story formats unlock, the same uploader can render
 * frames + posters without an API change.
 */

interface Props {
  value: FeedMediaItem[];
  onChange: (next: FeedMediaItem[]) => void;
  /** Hard cap, defaults to 12 (matches DB jsonb soft limit). */
  max?: number;
  disabled?: boolean;
}

function errorMessage(code: string): string {
  switch (code) {
    case 'too_large':         return 'Arquivo acima de 8 MB.';
    case 'unsupported_type':  return 'Formato não suportado (use JPG, PNG, WEBP ou GIF).';
    case 'no_file':           return 'Nenhum arquivo selecionado.';
    case 'write_failed':      return 'Falha ao salvar imagem no servidor.';
    default:                  return 'Não foi possível enviar.';
  }
}

export default function FeedImageUploader({
  value,
  onChange,
  max = 12,
  disabled,
}: Props) {
  const [active, setActive] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      const slotsLeft = Math.max(0, max - value.length);
      const accepted = arr.slice(0, slotsLeft);
      if (accepted.length < arr.length) {
        setError(`Limite de ${max} imagens. ${arr.length - accepted.length} ignoradas.`);
      } else {
        setError(null);
      }

      setUploading((n) => n + accepted.length);
      const uploaded: FeedMediaItem[] = [];
      await Promise.all(
        accepted.map(async (file) => {
          try {
            const res = await feedService.uploadImage(file);
            uploaded.push({ url: res.url, alt: file.name.replace(/\.[^.]+$/, '') });
          } catch (err) {
            const code = err instanceof Error ? err.message : 'write_failed';
            setError(`${file.name}: ${errorMessage(code)}`);
          } finally {
            setUploading((n) => Math.max(0, n - 1));
          }
        }),
      );
      if (uploaded.length > 0) onChange([...value, ...uploaded]);
    },
    [max, onChange, value],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setActive(false);
      if (disabled) return;
      // If a tile is being reordered, the dropTarget handler on the
      // tile manages it; this only fires when the source is the OS.
      if (dragIndex !== null) return;
      if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
    },
    [disabled, dragIndex, handleFiles],
  );

  const remove = useCallback(
    (idx: number) => {
      const next = value.slice();
      next.splice(idx, 1);
      onChange(next);
    },
    [onChange, value],
  );

  const reorder = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0) return;
      const next = value.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    [onChange, value],
  );

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.dropZone} ${active ? styles.dropZoneActive : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && dragIndex === null) setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <IconImage size={20} />
        <div>
          <div className={styles.dropTitle}>
            Arraste imagens aqui ou clique para enviar
          </div>
          <div className={styles.dropHint}>
            JPG, PNG, WEBP, GIF · até 8 MB por arquivo · máx. {max} imagens
          </div>
        </div>
        {uploading > 0 && (
          <span className={styles.uploading}>
            <span className={styles.spinner} aria-hidden="true" />
            Enviando {uploading} imagem{uploading > 1 ? 'ns' : ''}…
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          className={styles.fileInput}
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            // Reset so re-picking the same file fires onChange again.
            e.target.value = '';
          }}
          disabled={disabled}
        />
      </div>

      {error && <div className={styles.errorRow}>{error}</div>}

      {value.length > 0 && (
        <>
          <span className={styles.counter}>
            {value.length} {value.length === 1 ? 'imagem' : 'imagens'} · arraste para reordenar
          </span>
          <div className={styles.grid}>
            {value.map((item, idx) => (
              <div
                key={`${item.url}-${idx}`}
                className={`${styles.tile} ${dragIndex === idx ? styles.tileDragging : ''} ${
                  overIndex === idx && dragIndex !== idx ? styles.tileDropTarget : ''
                }`}
                draggable={!disabled}
                onDragStart={(e) => {
                  setDragIndex(idx);
                  // Required for Firefox to fire dragover/drop.
                  try {
                    e.dataTransfer.setData('text/plain', String(idx));
                    e.dataTransfer.effectAllowed = 'move';
                  } catch {
                    /* ignore */
                  }
                }}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  setOverIndex(idx);
                }}
                onDragLeave={() => {
                  setOverIndex((v) => (v === idx ? null : v));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) reorder(dragIndex, idx);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveAssetUrl(item.url)}
                  alt={item.alt ?? ''}
                  className={styles.tileImg}
                />
                {idx === 0 && <span className={styles.coverBadge}>Capa</span>}
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(idx);
                  }}
                  aria-label="Remover imagem"
                  title="Remover"
                >
                  <IconX size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
