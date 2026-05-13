'use client';

import { Fragment } from 'react';
import styles from './MessageBody.module.css';

/**
 * Renders a chat message body with three enhancements over plain text:
 *
 *   1. A leading reply-quote block (see REPLY_PREFIX_RE) is rendered
 *      as a stylized quoted preview, with the actual reply text
 *      flowing below it.
 *   2. URLs are wrapped in <a> tags (basic linkification).
 *   3. The FIRST recognized video URL in the body — YouTube, Vimeo,
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

// ── Reply-quote prefix ─────────────────────────────────────────
// Reply context is encoded inline in the body for now (no schema
// change needed). Format produced by buildReplyBody():
//
//   ↪ {Name}: "{quoted original text, possibly truncated}"
//   \n\n
//   {actual new message body}
//
// This regex matches that prefix non-greedily; the named group
// captures the rest as the user's reply text.
const REPLY_PREFIX_RE = /^↪ (.+?): "((?:[^"\\]|\\.)+)"\n\n([\s\S]*)$/;

/** Build a body string carrying a reply quote. Truncates the quoted
 *  original at MAX_QUOTE_LEN so a single huge message can't dominate
 *  the bubble.
 *
 *  Exported so the chat panels can wrap user input before sending. */
const MAX_QUOTE_LEN = 120;
export function buildReplyBody(
  originalSenderName: string,
  originalBody: string,
  replyBody: string,
): string {
  // Strip any pre-existing reply prefix from the original — replying
  // to a reply only quotes the most-recent message, not the chain.
  const stripped = stripReplyPrefix(originalBody);
  const quoted = stripped.length > MAX_QUOTE_LEN
    ? stripped.slice(0, MAX_QUOTE_LEN).trimEnd() + '…'
    : stripped;
  // Escape backslashes + double quotes so the regex parser at read
  // time can recover the original text unambiguously.
  const safe = quoted.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `↪ ${originalSenderName}: "${safe}"\n\n${replyBody}`;
}

/** Return just the user-visible body (no reply prefix). Used by the
 *  quote-builder above and by callers that want a clean preview of
 *  a message (e.g. the dock's last-message tooltip). */
export function stripReplyPrefix(body: string): string {
  const m = body.match(REPLY_PREFIX_RE);
  return m ? m[3] : body;
}

interface ReplyHeader {
  sender: string;
  quoted: string;
  rest: string;
}

function parseReplyHeader(body: string): ReplyHeader | null {
  const m = body.match(REPLY_PREFIX_RE);
  if (!m) return null;
  return {
    sender: m[1],
    // Un-escape what buildReplyBody escaped.
    quoted: m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
    rest: m[3],
  };
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
  // Peel off the reply-quote prefix (if any) BEFORE looking for
  // video URLs — otherwise a video link inside the quoted text
  // would render twice (once in the quote, once below).
  const reply = parseReplyHeader(body);
  const visibleBody = reply ? reply.rest : body;
  const preview = firstVideoPreview(visibleBody);

  return (
    <>
      {reply && (
        <div className={styles.replyQuote}>
          <span className={styles.replyQuoteSender}>{reply.sender}</span>
          <span className={styles.replyQuoteText}>{reply.quoted}</span>
        </div>
      )}

      <span className={styles.text}>{renderLinkified(visibleBody)}</span>

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
