'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { track } from '@/lib/analytics';
import type {
  ApiFeedComment,
  ApiFeedCommentsPage,
} from '@/lib/api/types';
import CommentInput from './CommentInput';
import CommentItem from './CommentItem';
import styles from './CommentsPanel.module.css';

/** Pull every @[Display](uuid) token out of a body — same shape
 *  the server uses to extract mentions, mirrored here so the
 *  client-side `mention_count` analytic stays accurate. */
const MENTION_COUNT_RE = /@\[[^\]]+\]\([0-9a-f-]{36}\)/g;
function countMentions(body: string): number {
  return (body.match(MENTION_COUNT_RE) ?? []).length;
}

/**
 * Top-level comments panel for a single feed post.
 *
 * Wiring:
 *   - Opens lazily — the first time `open` flips to true it kicks
 *     off the initial fetch. Subsequent close+reopen reuses the
 *     existing state so the user doesn't lose their scroll position.
 *   - Pagination: keyset (`before` = oldest item's createdAt). The
 *     "Carregar mais" button at the bottom is the load-more trigger.
 *     Easy upgrade path to real infinite-scroll later — just swap
 *     the button for an IntersectionObserver sentinel.
 *   - Reply threads: parent owns the map { parentId → replies[] }
 *     and the open-set, so toggle/like/delete inside a thread stay
 *     consistent across rerenders.
 *   - Notifications fire server-side on POST: comment_reply when
 *     replying, comment_mention when a mention resolves to a real
 *     user, comment_reaction when ❤️-ing. Future-proof: the
 *     notification rows for replies/mentions sit in the same table
 *     as everything else the bell already polls.
 */

interface Props {
  /** Stable identifier for the post. Derived from media src by MediaPost. */
  postKey: string;
  /** Approximate count to seed the header before the first fetch returns. */
  initialCommentCount?: number;
  /** Render — only matters for layout; mounting still loads on first open. */
  open: boolean;
  /** Fires whenever the panel's authoritative comment count changes:
   *  on initial fetch, after a successful create, after a delete.
   *  Used by MediaPost to keep the icon badge in sync with reality
   *  instead of relying on the stale prop. */
  onCountChange?: (count: number) => void;
}

const PAGE_SIZE = 10;

export default function CommentsPanel({
  postKey,
  initialCommentCount,
  open,
  onCountChange,
}: Props) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const currentUserAvatar = user?.avatarUrl ?? null;
  const currentUserIsAdmin = user?.role === 'admin';

  // Top-level comments (newest first).
  const [comments, setComments] = useState<ApiFeedComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Delta from the server-side count seeded by `initialCommentCount`.
  // Counts both top-level and replies (matches the server's
  // correlated COUNT subquery which doesn't distinguish levels).
  // Lifted to MediaPost via the effect below.
  const [countDelta, setCountDelta] = useState<number>(0);
  useEffect(() => {
    if (!onCountChange) return;
    onCountChange((initialCommentCount ?? 0) + countDelta);
  }, [initialCommentCount, countDelta, onCountChange]);

  // Reply state — owned here so CommentItem can stay presentational.
  const [repliesByParent, setRepliesByParent] = useState<
    Record<string, ApiFeedComment[]>
  >({});
  const [openReplyThreads, setOpenReplyThreads] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  // Resolved postId — set on first GET. Used as a sanity flag too
  // (null means we haven't fetched yet, so the empty state stays
  // hidden until the request actually returns).
  const [postId, setPostId] = useState<string | null>(null);

  // Guard against React 18 StrictMode firing useEffect twice from
  // double-mounting in dev (the initial GET shouldn't run twice).
  const initFiredRef = useRef(false);

  const fetchInitial = useCallback(async () => {
    setInitialLoading(true);
    try {
      const page = await api.get<ApiFeedCommentsPage>(
        `/api/feed/posts/${encodeURIComponent(postKey)}/comments?limit=${PAGE_SIZE}`,
      );
      setComments(page.items);
      setHasMore(page.hasMore);
      setCursor(page.nextCursor);
      setPostId(page.postId);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) {
        console.error('fetch comments failed:', err);
      }
    } finally {
      setInitialLoading(false);
    }
  }, [postKey]);

  // Lazy load on first open.
  useEffect(() => {
    if (!open) return;
    if (initFiredRef.current) return;
    initFiredRef.current = true;
    fetchInitial();
  }, [open, fetchInitial]);

  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore || moreLoading) return;
    setMoreLoading(true);
    try {
      const page = await api.get<ApiFeedCommentsPage>(
        `/api/feed/posts/${encodeURIComponent(postKey)}/comments?limit=${PAGE_SIZE}&before=${encodeURIComponent(cursor)}`,
      );
      setComments((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
      setCursor(page.nextCursor);
    } catch (err) {
      console.error('load more comments failed:', err);
    } finally {
      setMoreLoading(false);
    }
  }, [cursor, hasMore, moreLoading, postKey]);

  const handleSubmit = useCallback(
    async (body: string) => {
      setSubmitting(true);
      try {
        const res = await api.post<{ id: string; postId: string }>(
          `/api/feed/posts/${encodeURIComponent(postKey)}/comments`,
          { body },
        );
        setPostId(res.postId);
        track('comment_created', {
          post_id: res.postId,
          comment_id: res.id,
          body_length: body.length,
          mention_count: countMentions(body),
        });
        // Optimistic prepend.
        const optimistic: ApiFeedComment = {
          id: res.id,
          postId: res.postId,
          parentCommentId: null,
          body,
          createdAt: new Date().toISOString(),
          deletedAt: null,
          author: {
            id: currentUserId ?? 'me',
            name: user?.name ?? 'Você',
            email: user?.email ?? '',
            avatarUrl: currentUserAvatar,
          },
          reactions: { count: 0, mine: false },
          replyCount: 0,
        };
        setComments((prev) => [optimistic, ...prev]);
        // Top-level create — bump the lifted count.
        setCountDelta((d) => d + 1);
      } catch (err) {
        console.error('post comment failed:', err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [currentUserAvatar, currentUserId, postKey, user?.email, user?.name],
  );

  // ── Local state mutations called by CommentItem ────────────────

  const replaceTopLevel = useCallback((next: ApiFeedComment) => {
    setComments((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  }, []);

  const replaceReply = useCallback((next: ApiFeedComment) => {
    if (!next.parentCommentId) return;
    setRepliesByParent((prev) => {
      const list = prev[next.parentCommentId!] ?? [];
      return {
        ...prev,
        [next.parentCommentId!]: list.map((r) => (r.id === next.id ? next : r)),
      };
    });
  }, []);

  const deleteTopLevel = useCallback((id: string) => {
    // Soft delete — mark the row as deleted locally so the
    // "Comentário removido" placeholder renders. The server already
    // soft-deleted by zeroing body + setting deletedAt.
    setComments((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, deletedAt: new Date().toISOString(), body: '' }
          : c,
      ),
    );
    setCountDelta((d) => d - 1);
  }, []);

  const deleteReply = useCallback((id: string) => {
    setRepliesByParent((prev) => {
      const out: typeof prev = {};
      for (const [k, list] of Object.entries(prev)) {
        out[k] = list.map((r) =>
          r.id === id ? { ...r, deletedAt: new Date().toISOString(), body: '' } : r,
        );
      }
      return out;
    });
    setCountDelta((d) => d - 1);
  }, []);

  const onReplyCreated = useCallback(
    (parentId: string, reply: ApiFeedComment) => {
      setRepliesByParent((prev) => {
        const list = prev[parentId] ?? [];
        return { ...prev, [parentId]: [...list, reply] };
      });
      // Reply create — bump the lifted count (the server's
      // COUNT(*) subquery counts replies too).
      setCountDelta((d) => d + 1);
      // Auto-open the thread + bump the parent's replyCount.
      setOpenReplyThreads((prev) => {
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replyCount: (c.replyCount ?? 0) + 1 }
            : c,
        ),
      );
    },
    [],
  );

  const toggleReplies = useCallback(
    async (parentId: string) => {
      const isOpen = openReplyThreads.has(parentId);
      if (isOpen) {
        setOpenReplyThreads((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
        return;
      }

      setOpenReplyThreads((prev) => {
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });

      // Already fetched? Reuse — replies don't refetch on reopen.
      if (repliesByParent[parentId]) return;

      setLoadingReplies((prev) => {
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });
      try {
        const res = await api.get<{ items: ApiFeedComment[] }>(
          `/api/feed/comments/${parentId}/replies?limit=50`,
        );
        setRepliesByParent((prev) => ({ ...prev, [parentId]: res.items }));
      } catch (err) {
        console.error('fetch replies failed:', err);
      } finally {
        setLoadingReplies((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
    },
    [openReplyThreads, repliesByParent],
  );

  // ── Render ─────────────────────────────────────────────────────

  if (!open) return null;

  // Live total — uses local list length when the server hasn't
  // returned yet, otherwise falls back to the initial mock count.
  const total = comments.length || initialCommentCount || 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Comentários</span>
        <span className={styles.headerCount}>
          {total} {total === 1 ? 'comentário' : 'comentários'}
        </span>
      </div>

      {/* Composer — always visible at top so users can drop a quick
          comment without scrolling past existing ones. */}
      <CommentInput
        currentUserAvatar={currentUserAvatar}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      <div className={styles.thread}>
        {/* Skeleton: render 3 rows on initial load so the panel
            doesn't look empty before the network resolves. */}
        {initialLoading && comments.length === 0 && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.skeletonAvatar} />
                <div className={styles.skeletonLines}>
                  <div className={styles.skeletonLineA} />
                  <div className={styles.skeletonLineB} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty state — only after the fetch has resolved (postId set)
            and we know there's nothing. */}
        {!initialLoading && postId !== null && comments.length === 0 && (
          <div className={styles.empty}>
            <strong>Seja o primeiro a comentar</strong>
            Compartilhe o que achou desse post.
          </div>
        )}

        {comments.map((c) => {
          const open = openReplyThreads.has(c.id);
          const replies = repliesByParent[c.id] ?? [];
          const loading = loadingReplies.has(c.id);
          return (
            <div key={c.id}>
              <CommentItem
                comment={c}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                currentUserIsAdmin={currentUserIsAdmin}
                onChanged={replaceTopLevel}
                onDeleted={deleteTopLevel}
                onReplyCreated={onReplyCreated}
                onToggleReplies={() => toggleReplies(c.id)}
                repliesOpen={open}
              />
              {open && (
                <div className={styles.replies}>
                  {loading && replies.length === 0 && (
                    <div className={styles.skeletonRow}>
                      <div className={styles.skeletonAvatar} />
                      <div className={styles.skeletonLines}>
                        <div className={styles.skeletonLineA} />
                        <div className={styles.skeletonLineB} />
                      </div>
                    </div>
                  )}
                  {replies.map((r) => (
                    <CommentItem
                      key={r.id}
                      comment={r}
                      currentUserId={currentUserId}
                      currentUserAvatar={currentUserAvatar}
                      currentUserIsAdmin={currentUserIsAdmin}
                      isReply
                      onChanged={replaceReply}
                      onDeleted={deleteReply}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {hasMore && comments.length > 0 && (
          <button
            type="button"
            className={styles.loadMore}
            onClick={loadMore}
            disabled={moreLoading}
          >
            {moreLoading ? 'Carregando…' : 'Carregar mais comentários'}
          </button>
        )}
      </div>
    </div>
  );
}
