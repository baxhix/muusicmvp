'use client';

import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { track } from '@/lib/analytics';
import { awardPoints } from '@/lib/rewards';
import type { ApiFeedComment, ApiFeedCommentReactionResult } from '@/lib/api/types';
import CommentInput from './CommentInput';
import HeartButton from './HeartButton';
import styles from './CommentsPanel.module.css';

/** Local mention-count helper. Mirrors the regex in CommentsPanel
 *  + the server-side parseMentions so analytics stay aligned. */
const MENTION_COUNT_RE = /@\[[^\]]+\]\([0-9a-f-]{36}\)/g;
function countMentions(body: string): number {
  return (body.match(MENTION_COUNT_RE) ?? []).length;
}

/**
 * One comment row — top-level OR reply. Stays presentational: all
 * persistent state (current replies, which threads are open, the
 * full comments list) lives in CommentsPanel, and this component
 * just calls back to mutate it.
 *
 * Reply UI:
 *   - Top-level: shows "Responder" button + "Ver respostas (N)" toggle
 *     and the inline reply composer when the button is clicked.
 *   - Reply (isReply=true): no Responder button (flat threading — we
 *     deliberately don't allow replies-of-replies) and an indent +
 *     thread line via .commentReply.
 */

interface Props {
  comment: ApiFeedComment;
  currentUserId: string | null;
  currentUserAvatar: string | null;
  currentUserIsAdmin: boolean;
  isReply?: boolean;
  /** Like-toggle / soft-delete bubble up to the panel so it can
   *  reconcile its local comments + replies state. */
  onChanged: (next: ApiFeedComment) => void;
  onDeleted: (id: string) => void;
  /** Called by the reply composer when the user submits a reply.
   *  Only ever invoked for top-level rows (isReply=false). */
  onReplyCreated?: (parentId: string, reply: ApiFeedComment) => void;
  /** Toggle the inline reply thread open/closed. Top-level only. */
  onToggleReplies?: () => void;
  repliesOpen?: boolean;
}

/* ── Icons ── */
const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg
    className={styles.heart}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const ReplyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

/** Compact pt-BR relative time. Same shape as the rest of the feed. */
function relativeTime(iso: string): string {
  const dt = new Date(iso).getTime();
  const now = Date.now();
  const secs = Math.max(1, Math.floor((now - dt) / 1000));
  if (secs < 60) return 'agora';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}sem`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;
  return `${Math.floor(days / 365)}a`;
}

/* ── @[Display](uuid) → inline chip. URLs left as plain text since
 *  comments are short and a full linkifier would balloon the bundle. */
const MENTION_REGEX = /(@\[[^\]]+\]\([0-9a-f-]{36}\))/g;
const MENTION_PARSE = /^@\[([^\]]+)\]\(([0-9a-f-]{36})\)$/;

function renderBody(body: string): React.ReactNode {
  const parts = body.split(MENTION_REGEX);
  return parts.map((p, i) => {
    const m = p.match(MENTION_PARSE);
    if (m) {
      return (
        <span key={i} className={styles.mention}>@{m[1]}</span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function CommentItem({
  comment,
  currentUserId,
  currentUserAvatar,
  currentUserIsAdmin,
  isReply = false,
  onChanged,
  onDeleted,
  onReplyCreated,
  onToggleReplies,
  repliesOpen,
}: Props) {
  const [replyComposerOpen, setReplyComposerOpen] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);

  const canDelete =
    currentUserId !== null &&
    (currentUserIsAdmin || comment.author.id === currentUserId) &&
    !comment.deletedAt;

  const handleLike = useCallback(async () => {
    if (comment.deletedAt) return;
    // Optimistic flip; roll back on failure.
    const prev = comment.reactions;
    onChanged({
      ...comment,
      reactions: {
        count: prev.count + (prev.mine ? -1 : 1),
        mine: !prev.mine,
      },
    });
    try {
      const res = await api.post<ApiFeedCommentReactionResult>(
        `/api/feed/comments/${comment.id}/reactions`,
      );
      onChanged({
        ...comment,
        reactions: { count: res.count, mine: res.mine },
      });
      track('comment_reaction_toggled', {
        comment_id: comment.id,
        action: res.action,
        emoji: '❤️',
      });
    } catch (err) {
      onChanged({ ...comment, reactions: prev });
      if (err instanceof ApiError && err.status !== 401) {
        console.error('toggle reaction failed:', err);
      }
    }
  }, [comment, onChanged]);

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;
    onDeleted(comment.id);
    try {
      await api.delete(`/api/feed/comments/${comment.id}`);
      track('comment_deleted', {
        comment_id: comment.id,
        is_own: comment.author.id === currentUserId,
      });
    } catch (err) {
      console.error('delete comment failed:', err);
    }
  }, [canDelete, comment.id, comment.author.id, currentUserId, onDeleted]);

  const handleReplySubmit = useCallback(
    async (body: string) => {
      setReplySubmitting(true);
      try {
        const { id } = await api.post<{ id: string; postId: string }>(
          `/api/feed/comments/${comment.id}/replies`,
          { body },
        );
        track('comment_reply_created', {
          post_id: comment.postId,
          parent_comment_id: comment.id,
          comment_id: id,
          body_length: body.length,
          mention_count: countMentions(body),
        });
        // Engagement reward (+10 FP) — server-side createComment
        // already inserted the ledger row, this just shows the
        // toast + analytics on the client. Replies count as
        // comments for reward purposes (same +10).
        void awardPoints('comment', {
          analyticsContext: {
            post_id: comment.postId,
            comment_id: id,
            parent_comment_id: comment.id,
          },
        });
        const optimistic: ApiFeedComment = {
          id,
          postId: comment.postId,
          parentCommentId: comment.id,
          body,
          createdAt: new Date().toISOString(),
          deletedAt: null,
          author: {
            id: currentUserId ?? 'me',
            name: 'Você',
            email: '',
            avatarUrl: currentUserAvatar,
          },
          reactions: { count: 0, mine: false },
          replyCount: null,
        };
        onReplyCreated?.(comment.id, optimistic);
        setReplyComposerOpen(false);
      } catch (err) {
        console.error('post reply failed:', err);
        throw err;
      } finally {
        setReplySubmitting(false);
      }
    },
    [comment.id, comment.postId, currentUserAvatar, currentUserId, onReplyCreated],
  );

  return (
    <div className={`${styles.comment} ${isReply ? styles.commentReply : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.avatar}
        src={comment.author.avatarUrl ?? '/avatar-placeholder.svg'}
        alt={comment.author.name ?? comment.author.email}
      />
      <div className={styles.body}>
        <div className={styles.identityRow}>
          <span className={styles.authorName}>
            {comment.author.name ?? comment.author.email}
          </span>
          {/* @handle removed per product feedback — the display name +
              avatar already identify the author, and the handle was
              adding visual noise without providing extra signal. */}
          <span className={styles.authorTime}>
            {relativeTime(comment.createdAt)}
          </span>
        </div>

        <div className={`${styles.text} ${comment.deletedAt ? styles.textDeleted : ''}`}>
          {comment.deletedAt ? 'Comentário removido.' : renderBody(comment.body)}
        </div>

        <div className={styles.commentActions}>
          {/* HeartButton reutilizável: scale pop + 6 sparkles radial
           *  ao curtir (estilo Instagram). Pink fill quando active. */}
          <HeartButton
            active={comment.reactions.mine}
            onToggle={handleLike}
            count={comment.reactions.count}
            disabled={!!comment.deletedAt}
            ariaLabel={comment.reactions.mine ? 'Descurtir comentário' : 'Curtir comentário'}
          />

          {!isReply && !comment.deletedAt && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.replyBtn}`}
              onClick={() => setReplyComposerOpen((v) => !v)}
              aria-label="Responder"
            >
              <ReplyIcon />
              Responder
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.danger}`}
              onClick={handleDelete}
              aria-label="Apagar comentário"
              title="Apagar comentário"
            >
              {/* "Apagar" label removed per product feedback — the
                  trash icon is unambiguous on its own. The
                  aria-label / title still announce the action for
                  screen readers and the hover tooltip. */}
              <TrashIcon />
            </button>
          )}
        </div>

        {!isReply && replyComposerOpen && (
          <div className={styles.replyComposer}>
            <CommentInput
              placeholder={`Responder a ${comment.author.name ?? 'usuário'}…`}
              currentUserAvatar={currentUserAvatar}
              submitting={replySubmitting}
              autoFocus
              onSubmit={handleReplySubmit}
              onCancel={() => setReplyComposerOpen(false)}
            />
          </div>
        )}

        {!isReply && (comment.replyCount ?? 0) > 0 && onToggleReplies && (
          <button
            type="button"
            className={styles.viewReplies}
            onClick={onToggleReplies}
            aria-expanded={!!repliesOpen}
          >
            <span className={styles.threadDash} />
            {repliesOpen
              ? 'Ocultar respostas'
              : `Ver respostas (${comment.replyCount})`}
          </button>
        )}
      </div>
    </div>
  );
}
