'use client';

import { useCallback, useRef, useState } from 'react';
import { IconImage, IconUpload, IconX } from '@/components/icons';
import { blogImagesService } from '@/services/blog/images';
import { resolveAssetUrl } from '@/lib/utils';
import styles from './BlogImageUploader.module.css';

/**
 * BlogImageUploader — uploader single-image pro módulo de Blog.
 *
 * Estados:
 *   - **vazio**: drop zone clicável "Arraste ou clique pra enviar"
 *   - **com imagem**: preview ocupa o card; hover revela botões
 *     "Trocar" e "Remover" sem precisar abrir menus
 *
 * Aceita JPG/PNG/WEBP/GIF até 8 MB (mesma policy do uploader do
 * feed, já que reusamos o backend `/api/admin/feed/upload`).
 *
 * Por que single-image (e não compartilhar `FeedImageUploader`):
 *   - Cover de post + og:image são sempre uma única imagem; UI
 *     fica mais limpa sem grid, badge "Capa", reorder.
 *   - Reaproveita os tokens de design e o mesmo serviço de
 *     upload — visual e endpoint consistentes.
 *
 * O componente é "controlled" por URL string pra encaixar
 * direto no FormState do PostEditor sem adapters.
 */

export interface BlogImageUploaderProps {
  /** URL atual (relativa ou absoluta). String vazia = sem imagem. */
  value: string;
  /** Recebe a nova URL ou '' quando o usuário remove. */
  onChange: (url: string) => void;
  /** Texto descritivo abaixo do drop zone vazio. */
  hint?: string;
  /** Aspect ratio do preview. Default '16/9' (cover de post). */
  aspectRatio?: '16/9' | '4/3' | '1/1';
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

export default function BlogImageUploader({
  value,
  onChange,
  hint = 'JPG, PNG, WEBP ou GIF · até 8 MB',
  aspectRatio = '16/9',
  disabled,
}: BlogImageUploaderProps) {
  const [active, setActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const res = await blogImagesService.upload(file);
        onChange(res.url);
      } catch (err) {
        const code = err instanceof Error ? err.message : 'write_failed';
        setError(errorMessage(code));
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      // Single-image: pega só o primeiro mesmo que o user solte vários.
      void upload(arr[0]);
    },
    [upload],
  );

  const aspectClass =
    aspectRatio === '1/1'
      ? styles.ratioSquare
      : aspectRatio === '4/3'
        ? styles.ratio43
        : styles.ratio169;

  // ── Estado com imagem ─────────────────────────────────────────
  if (value) {
    return (
      <div className={styles.wrap}>
        <div className={`${styles.preview} ${aspectClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAssetUrl(value)}
            alt=""
            className={styles.previewImg}
          />
          <div className={styles.previewActions}>
            <button
              type="button"
              className={styles.previewBtn}
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              title="Trocar imagem"
            >
              <IconUpload size={12} />
              Trocar
            </button>
            <button
              type="button"
              className={`${styles.previewBtn} ${styles.previewBtnDanger}`}
              onClick={() => onChange('')}
              disabled={disabled || uploading}
              title="Remover imagem"
            >
              <IconX size={12} />
              Remover
            </button>
          </div>
          {uploading && (
            <div className={styles.uploadingOverlay}>
              <span className={styles.spinner} aria-hidden="true" />
              <span>Enviando…</span>
            </div>
          )}
        </div>
        {error && <div className={styles.errorRow}>{error}</div>}
        <input
          ref={inputRef}
          type="file"
          className={styles.fileInput}
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
          disabled={disabled || uploading}
        />
      </div>
    );
  }

  // ── Estado vazio (drop zone) ──────────────────────────────────
  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.dropZone} ${aspectClass} ${active ? styles.dropZoneActive : ''}`}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setActive(false);
          if (disabled || uploading) return;
          if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <IconImage size={22} />
        <div className={styles.dropBody}>
          <div className={styles.dropTitle}>
            {uploading
              ? 'Enviando…'
              : 'Arraste uma imagem aqui ou clique para enviar'}
          </div>
          <div className={styles.dropHint}>{hint}</div>
        </div>
        {uploading && (
          <span className={styles.uploadingBadge}>
            <span className={styles.spinner} aria-hidden="true" />
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          className={styles.fileInput}
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
          disabled={disabled || uploading}
        />
      </div>
      {error && <div className={styles.errorRow}>{error}</div>}
    </div>
  );
}
