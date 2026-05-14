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

// ── Mention token ────────────────────────────────────────────────
// Mentions are stored inline in the body as @[Display Name](uuid).
// Format chosen because it's:
//   - Markdown-link-ish, so it's familiar to most devs
//   - Parseable with a single regex
//   - Survives copy/paste + storage as-is (no schema column needed)
//
// Capture groups: (1) display name, (2) uuid. Global flag lets us
// split() the body around all mentions.
const MENTION_REGEX =
  /(@\[[^\]]+\]\([0-9a-f-]{36}\))/g;
const MENTION_PARSE_REGEX =
  /^@\[([^\]]+)\]\(([0-9a-f-]{36})\)$/;

/** Extracts every userId mentioned in a body. Used server-side to
 *  fan out notifications, exported here so the chat panel can also
 *  preview / validate before sending. */
export function extractMentionedUserIds(body: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(MENTION_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const parsed = m[0].match(MENTION_PARSE_REGEX);
    if (parsed) ids.push(parsed[2]);
  }
  return Array.from(new Set(ids));
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

// Image file (http URL form). Same shape as VIDEO_FILE_REGEX but
// covers common raster + lossless formats served over the wire.
const IMAGE_URL_REGEX =
  /^https?:\/\/\S+\.(png|jpe?g|webp|gif|avif)(\?\S*)?$/i;

// Local image path — anything starting with "/" and ending in an
// image extension. Used so chat fixtures (e.g. the fake Ana posts)
// can reference assets bundled in /public without needing a full URL.
const LOCAL_IMAGE_PATH_REGEX =
  /(?:^|\s)(\/[\w./-]+\.(?:png|jpe?g|webp|gif|avif))(?=\s|$)/i;

type Preview =
  | { kind: 'youtube'; id: string; href: string }
  | { kind: 'vimeo'; id: string; href: string }
  | { kind: 'file'; href: string }
  | { kind: 'image'; href: string };

/** Scan the body and return the FIRST preview-able media reference.
 *  Looks for YouTube/Vimeo embeds, bare video files, image URLs,
 *  and finally local image paths starting with "/". */
function firstMediaPreview(body: string): Preview | null {
  const urls = body.match(URL_REGEX);
  if (urls) {
    for (const href of urls) {
      const yt = href.match(YT_REGEX);
      if (yt) return { kind: 'youtube', id: yt[1], href };
      const vimeo = href.match(VIMEO_REGEX);
      if (vimeo) return { kind: 'vimeo', id: vimeo[1], href };
      if (VIDEO_FILE_REGEX.test(href)) return { kind: 'file', href };
      if (IMAGE_URL_REGEX.test(href)) return { kind: 'image', href };
    }
  }
  // Local-path fallback for in-bundle assets like /feed/something.png
  const pathMatch = body.match(LOCAL_IMAGE_PATH_REGEX);
  if (pathMatch) return { kind: 'image', href: pathMatch[1] };
  return null;
}

/** Render plain text with two enhancements:
 *
 *   - URL_REGEX matches get wrapped in <a target=_blank> (linkified).
 *   - MENTION_REGEX matches get rendered as accent-colored pills.
 *
 * Done in two passes (mentions first, then linkify inside the
 * remaining text segments) so a URL inside a mention's display
 * name doesn't accidentally split the mention apart.
 */
function renderRichText(body: string) {
  // First split on mentions — these are the "tokens" we want to
  // peel out wholesale. Anything not a mention goes through the
  // linkifier.
  const mentionParts = body.split(MENTION_REGEX);
  return mentionParts.map((part, i) => {
    const m = part.match(MENTION_PARSE_REGEX);
    if (m) {
      return (
        <span key={i} className={styles.mention} data-user-id={m[2]}>
          @{m[1]}
        </span>
      );
    }
    return <Fragment key={i}>{renderLinkifiedInner(part)}</Fragment>;
  });
}

/** Linkify a fragment that's already been peeled of mentions. */
function renderLinkifiedInner(text: string) {
  const parts = text.split(URL_REGEX);
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
  const preview = firstMediaPreview(visibleBody);

  // When a video preview will render, hide its URL from the text —
  // the embed itself IS the affordance, the raw link adds clutter.
  // Surrounding text is preserved so messages like "olha esse: <url>
  // que doideira" still show "olha esse: que doideira" + the embed.
  const textToRender = preview
    ? visibleBody.replace(preview.href, '').replace(/\s{2,}/g, ' ').trim()
    : visibleBody;

  return (
    <>
      {reply && (
        <div className={styles.replyQuote}>
          <span className={styles.replyQuoteSender}>{reply.sender}</span>
          <span className={styles.replyQuoteText}>{reply.quoted}</span>
        </div>
      )}

      {textToRender && (
        <span className={styles.text}>{renderRichText(textToRender)}</span>
      )}

      {preview && preview.kind !== 'image' && (
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

      {/* Image attachments render in their own container (no
          16:9 lock from .previewWrap) so portraits / squares keep
          their natural aspect ratio. */}
      {preview && preview.kind === 'image' && (
        <div
          className={styles.imageWrap}
          style={{ maxWidth: `${maxPreviewWidth}px` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.href}
            alt=""
            className={styles.imageFrame}
            loading="lazy"
          />
        </div>
      )}
    </>
  );
}
