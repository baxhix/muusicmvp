'use client';

import { Fragment } from 'react';
import styles from './MessageBody.module.css';

/**
 * Renders a chat message body with two enhancements over plain text:
 *
 *   1. URLs are wrapped in <a> tags (basic linkification).
 *   2. The FIRST recognized video URL in the body — YouTube, Vimeo,
 *      or a direct mp4/webm — gets an inline preview rendered below
 *      the text, bounded to the bubble's width so it never overflows.
 *
 * Used by LiveChatPanel and SuperchatPanel. Deliberately framework-
 * less: takes a string body in, returns JSX out, no callbacks.
 */
interface Props {
  body: string;
  /**
   * Max width hint for the inline preview, in pixels. Defaults to
   * 320 — the previews use CSS to clamp at 100% of the parent too,
   * so this is a ceiling, not a floor.
   */
  maxPreviewWidth?: number;
}

// ── URL detection ────────────────────────────────────────────────
// Matches http(s) URLs. Intentionally simple — chat messages are
// short, we don't need IANA-compliant URL parsing here. The capture
// group lets us split the body around matches without losing them.
const URL_REGEX = /(\bhttps?:\/\/[^\s<>")]+)/gi;

// YouTube — covers youtu.be short links and youtube.com/watch?v= +
// youtube.com/embed/ + youtube.com/shorts/.
const YT_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/i;

// Vimeo — vimeo.com/<numeric id>.
const VIMEO_REGEX = /vimeo\.com\/(\d+)/i;

// Bare video file — http(s)://…/something.mp4 / .webm / .mov.
// Mov is iffy in browsers but we try anyway; user gets a generic
// "video unavailable" frame if the codec isn't supported.
const VIDEO_FILE_REGEX = /^https?:\/\/\S+\.(mp4|webm|mov)(\?\S*)?$/i;

type Preview =
  | { kind: 'youtube'; id: string; href: string }
  | { kind: 'vimeo'; id: string; href: string }
  | { kind: 'file'; href: string };

/** Scan the body and return the FIRST preview-able video URL. */
function firstVideoPreview(body: string): Preview | null {
  const urls = body.match(URL_REGEX);
  if (!urls) return null;
  for (const href of urls) {
    const yt = href.match(YT_REGEX);
    if (yt) return { kind: 'youtube', id: yt[1], href };
    const vimeo = href.match(VIMEO_REGEX);
    if (vimeo) return { kind: 'vimeo', id: vimeo[1], href };
    if (VIDEO_FILE_REGEX.test(href)) return { kind: 'file', href };
  }
  return null;
}

/** Linkify the plain text body — splits on URL_REGEX, keeps order. */
function renderLinkified(body: string) {
  const parts = body.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      // Reset regex state — split keeps the captures but `test` is
      // stateful with a global regex; safer to rebuild every check.
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function MessageBody({ body, maxPreviewWidth = 320 }: Props) {
  const preview = firstVideoPreview(body);

  return (
    <>
      <span className={styles.text}>{renderLinkified(body)}</span>

      {preview && (
        <div
          className={styles.previewWrap}
          style={{ maxWidth: `${maxPreviewWidth}px` }}
        >
          {preview.kind === 'youtube' && (
            <iframe
              className={styles.frame}
              src={`https://www.youtube.com/embed/${preview.id}?modestbranding=1&rel=0`}
              title="YouTube video"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
          {preview.kind === 'vimeo' && (
            <iframe
              className={styles.frame}
              src={`https://player.vimeo.com/video/${preview.id}`}
              title="Vimeo video"
              loading="lazy"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          )}
          {preview.kind === 'file' && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              className={styles.frame}
              src={preview.href}
              controls
              preload="metadata"
            />
          )}
        </div>
      )}
    </>
  );
}
