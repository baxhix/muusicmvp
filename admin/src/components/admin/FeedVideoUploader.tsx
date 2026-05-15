'use client';

import { useCallback, useRef, useState } from 'react';
import { IconImage, IconX } from '@/components/icons';
import { feedService } from '@/services/feed';
import { resolveAssetUrl } from '@/lib/utils';
import type { FeedMediaItem } from '@/types';
import styles from './FeedVideoUploader.module.css';

/**
 * Single-video uploader with optional poster (thumbnail).
 *
 *   - One video slot (mp4 / webm / mov / ogv, up to 100 MB).
 *     Replaces the previous file on a new upload — the composer
 *     never carries more than one video item for a video post.
 *   - Optional poster image (jpg/png/webp/gif, 8 MB) that the
 *     public feed uses as the autoplay frame + paused overlay.
 *     Falls back to the video's first frame when the browser
 *     auto-extracts one.
 *
 * Output shape (FeedMediaItem):
 *   { url, kind: 'video', alt?, poster? }
 *
 * Same value/onChange contract as the image uploader so the
 * composer can swap them with one branch.
 */

interface Props {
  /** The CURRENT media array. We treat the first video-kind item
   *  as the canonical video; non-video items are preserved on
   *  output (in case a future poll/sponsored type composes a
   *  mixed array). */
  value: FeedMediaItem[];
  onChange: (next: FeedMediaItem[]) => void;
  disabled?: boolean;
}

function errorMessage(code: string): string {
  switch (code) {
    case 'too_large':         return 'Vídeo acima de 100 MB.';
    case 'unsupported_type':  return 'Formato não suportado (MP4, WebM, MOV ou OGV).';
    case 'no_file':           return 'Nenhum arquivo selecionado.';
    case 'write_failed':      return 'Falha ao salvar vídeo no servidor.';
    default:                  return 'Não foi possível enviar.';
  }
}

function posterErrorMessage(code: string): string {
  switch (code) {
    case 'too_large':         return 'Capa acima de 8 MB.';
    case 'unsupported_type':  return 'Capa precisa ser JPG, PNG, WEBP ou GIF.';
    case 'no_file':           return 'Nenhuma capa selecionada.';
    case 'write_failed':      return 'Falha ao salvar capa.';
    default:                  return 'Não foi possível enviar a capa.';
  }
}

export default function FeedVideoUploader({
  value,
  onChange,
  disabled,
}: Props) {
  const [active, setActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  // Find the existing video item (if any). Non-video items are
  // pass-through so this uploader plays nice with future mixed
  // payloads.
  const video = value.find((m) => m.kind === 'video') ?? null;
  const otherItems = value.filter((m) => m.kind !== 'video');

  const handleFile = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
        const res = await feedService.uploadVideo(file);
        const next: FeedMediaItem = {
          url: res.url,
          kind: 'video',
          alt: file.name.replace(/\.[^.]+$/, ''),
          // Preserve the existing poster on a re-upload of the
          // video — if the admin uploaded a custom thumbnail, they
          // probably don't want to lose it when replacing the clip.
          poster: video?.poster ?? null,
        };
        onChange([next, ...otherItems]);
      } catch (err) {
        const code = err instanceof Error ? err.message : 'write_failed';
        setError(errorMessage(code));
      } finally {
        setUploading(false);
      }
    },
    [onChange, otherItems, video?.poster],
  );

  const handlePoster = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;
      if (!video) {
        // Defensive: the button is gated behind a video being
        // present, but a determined user could still trigger this.
        setError('Envie o vídeo antes da capa.');
        return;
      }
      setError(null);
      setUploadingPoster(true);
      try {
        const res = await feedService.uploadImage(file);
        onChange([{ ...video, poster: res.url }, ...otherItems]);
      } catch (err) {
        const code = err instanceof Error ? err.message : 'write_failed';
        setError(posterErrorMessage(code));
      } finally {
        setUploadingPoster(false);
      }
    },
    [onChange, otherItems, video],
  );

  const removeVideo = useCallback(() => {
    onChange(otherItems);
  }, [onChange, otherItems]);

  const removePoster = useCallback(() => {
    if (!video) return;
    onChange([{ ...video, poster: null }, ...otherItems]);
  }, [onChange, otherItems, video]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setActive(true);
  }, []);
  const onDragLeave = useCallback(() => setActive(false), []);
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setActive(false);
      if (disabled) return;
      handleFile(e.dataTransfer.files);
    },
    [disabled, handleFile],
  );

  return (
    <div className={styles.wrap}>
      {/* ── Video slot ───────────────────────────────────────── */}
      {!video ? (
        <div
          className={`${styles.dropZone} ${active ? styles.dropZoneActive : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !disabled && videoInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <span className={styles.dropTitle}>Solte o vídeo aqui ou clique para escolher</span>
          <span className={styles.dropHint}>MP4, WebM, MOV ou OGV — até 100 MB</span>
          {uploading && (
            <span className={styles.uploading}>
              <span className={styles.spinner} /> Enviando vídeo…
            </span>
          )}
        </div>
      ) : (
        <div className={styles.videoCard}>
          <video
            className={styles.videoPreview}
            src={resolveAssetUrl(video.url)}
            poster={video.poster ? resolveAssetUrl(video.poster) : undefined}
            controls
            playsInline
            preload="metadata"
          />
          <button
            type="button"
            className={styles.remove}
            onClick={removeVideo}
            aria-label="Remover vídeo"
            disabled={disabled}
          >
            <IconX />
          </button>
          <div className={styles.videoMeta}>
            <span className={styles.badge}>Vídeo</span>
            <button
              type="button"
              className={styles.replace}
              onClick={() => !disabled && videoInputRef.current?.click()}
              disabled={disabled || uploading}
            >
              {uploading ? 'Enviando…' : 'Substituir'}
            </button>
          </div>
        </div>
      )}

      {/* Hidden picker — kept outside conditional so the ref
          survives across renders. */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/ogg"
        className={styles.fileInput}
        onChange={(e) => {
          if (e.target.files) handleFile(e.target.files);
          e.target.value = ''; // allow re-pick of same file
        }}
        disabled={disabled}
      />

      {/* ── Poster (only after a video is present) ────────────── */}
      {video && (
        <div className={styles.posterRow}>
          <div className={styles.posterLabel}>
            <IconImage />
            <span>Capa do vídeo (opcional)</span>
          </div>
          {video.poster ? (
            <div className={styles.posterTile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveAssetUrl(video.poster)}
                alt="Capa do vídeo"
                className={styles.posterImg}
              />
              <button
                type="button"
                className={styles.removeSmall}
                onClick={removePoster}
                aria-label="Remover capa"
                disabled={disabled}
              >
                <IconX />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.posterPicker}
              onClick={() => !disabled && posterInputRef.current?.click()}
              disabled={disabled || uploadingPoster}
            >
              {uploadingPoster ? (
                <>
                  <span className={styles.spinner} /> Enviando capa…
                </>
              ) : (
                'Adicionar capa'
              )}
            </button>
          )}
          <input
            ref={posterInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.fileInput}
            onChange={(e) => {
              if (e.target.files) handlePoster(e.target.files);
              e.target.value = '';
            }}
            disabled={disabled}
          />
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
