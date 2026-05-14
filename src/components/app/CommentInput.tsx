'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './CommentsPanel.module.css';

interface Props {
  placeholder?: string;
  currentUserAvatar: string | null;
  submitting?: boolean;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<void> | void;
  /** Optional cancel button (used by the reply composer). */
  onCancel?: () => void;
}

/**
 * Multiline composer used for BOTH the top-level comment input
 * AND the inline reply composer that opens under a comment.
 *
 *   - Cmd/Ctrl + Enter or plain Enter (without Shift) submits.
 *   - Auto-grows up to ~96px; falls back to scroll past that so
 *     the post layout below the comments stays predictable.
 *   - Disables itself during submit so the click can't double-fire.
 *   - Clears its draft on a successful submit; throws keep the
 *     body intact so the user doesn't lose their text.
 */
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export default function CommentInput({
  placeholder = 'Escreva um comentário…',
  currentUserAvatar,
  submitting = false,
  autoFocus,
  onSubmit,
  onCancel,
}: Props) {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = body.trim();
  const canSubmit = !submitting && trimmed.length > 0 && trimmed.length <= 2000;

  // Auto-grow: reset to 0 first so shrinking from a long draft works,
  // then set to the natural scrollHeight (capped via CSS max-height).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px';
  }, [body]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) textareaRef.current.focus();
  }, [autoFocus]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await onSubmit(trimmed);
      // Successful submit → clear. Failure leaves the text in place.
      setBody('');
    } catch {
      // Error already surfaced to the user by the parent; keep draft.
    }
  };

  return (
    <div className={styles.inputRow}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.inputAvatar}
        src={currentUserAvatar ?? 'https://i.pravatar.cc/96?img=12'}
        alt=""
      />
      <textarea
        ref={textareaRef}
        className={styles.input}
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // Enter (no Shift) submits, Shift+Enter inserts newline.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === 'Escape' && onCancel) {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={1}
        maxLength={2000}
        disabled={submitting}
      />
      <button
        type="button"
        className={styles.sendBtn}
        onClick={handleSubmit}
        disabled={!canSubmit}
        aria-label="Enviar"
      >
        {submitting ? <span className={styles.sendSpinner} /> : <SendIcon />}
      </button>
    </div>
  );
}
