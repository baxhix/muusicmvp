'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api/client';
import HeartButton from './HeartButton';
import TruncatedText from './TruncatedText';
import { confirmDialog } from './ConfirmDialog';
import { showAppToast } from './AppToast';
import styles from './TrackCommentsModal.module.css';

/**
 * Comentários + likes de uma faixa/música. Aberto a partir da
 * PlaylistModal (ícone de comentário na row). As pessoas comentam e se
 * expressam tendo a música como tema; o coração dá like na faixa.
 * Tudo endereçado pelo youtubeId (/api/tracks/:ytId/...).
 */

export interface TrackRef {
  youtubeId: string;
  title: string;
  artist: string;
  img?: string;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; avatarUrl: string | null };
  isMine: boolean;
}

interface Social {
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function TrackCommentsModal({
  track,
  onClose,
}: {
  track: TrackRef;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [social, setSocial] = useState<Social>({
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
  });
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  const ytPath = encodeURIComponent(track.youtubeId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ comments: Comment[]; social: Social }>(
        `/api/tracks/${ytPath}/comments`,
      )
      .then((res) => {
        if (cancelled) return;
        setComments(res.comments);
        setSocial(res.social);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ytPath]);

  // Esc fecha.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleLike = useCallback(async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    // Optimista.
    setSocial((s) => ({
      ...s,
      likedByMe: !s.likedByMe,
      likeCount: s.likeCount + (s.likedByMe ? -1 : 1),
    }));
    try {
      const res = await api.post<{ liked: boolean; likeCount: number }>(
        `/api/tracks/${ytPath}/like`,
      );
      setSocial((s) => ({ ...s, likedByMe: res.liked, likeCount: res.likeCount }));
    } catch {
      // Rollback.
      setSocial((s) => ({
        ...s,
        likedByMe: !s.likedByMe,
        likeCount: s.likeCount + (s.likedByMe ? -1 : 1),
      }));
    } finally {
      setLikeBusy(false);
    }
  }, [likeBusy, ytPath]);

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await api.post<{ comment: Comment; social: Social }>(
        `/api/tracks/${ytPath}/comments`,
        { body },
      );
      setComments((cur) => [res.comment, ...cur]);
      setSocial(res.social);
      setDraft('');
    } catch {
      showAppToast({ message: 'Não foi possível enviar o comentário.', tone: 'error' });
    } finally {
      setPosting(false);
    }
  }, [draft, posting, ytPath]);

  const remove = useCallback(
    async (id: string) => {
      const ok = await confirmDialog({
        title: 'Apagar comentário?',
        confirmLabel: 'Apagar',
        tone: 'danger',
      });
      if (!ok) return;
      setComments((cur) => cur.filter((c) => c.id !== id));
      setSocial((s) => ({ ...s, commentCount: Math.max(0, s.commentCount - 1) }));
      try {
        await api.delete(`/api/tracks/${ytPath}/comments/${id}`);
      } catch {
        showAppToast({ message: 'Não foi possível apagar.', tone: 'error' });
      }
    },
    [ytPath],
  );

  if (!mounted) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-label={`Comentários de ${track.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          {track.img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.img} alt="" className={styles.cover} />
          )}
          <div className={styles.headInfo}>
            <TruncatedText className={styles.title} title={track.title}>
              {track.title}
            </TruncatedText>
            <TruncatedText className={styles.artist}>{track.artist}</TruncatedText>
          </div>
          <HeartButton
            active={social.likedByMe}
            onToggle={toggleLike}
            count={social.likeCount}
            size={20}
            disabled={likeBusy}
            ariaLabel={social.likedByMe ? 'Remover curtida' : 'Curtir música'}
          />
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </header>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>Carregando…</div>
          ) : comments.length === 0 ? (
            <div className={styles.empty}>
              Seja o primeiro a comentar sobre <strong>{track.title}</strong>.
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className={styles.row}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.author.avatarUrl ?? '/avatar-placeholder.svg'}
                  alt=""
                  className={styles.avatar}
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.src.endsWith('/avatar-placeholder.svg')) return;
                    el.src = '/avatar-placeholder.svg';
                  }}
                />
                <div className={styles.bubble}>
                  <div className={styles.rowHead}>
                    <span className={styles.author}>
                      {c.author.name ?? 'Anônimo'}
                    </span>
                    <span className={styles.time}>{timeAgo(c.createdAt)}</span>
                    {c.isMine && (
                      <button
                        type="button"
                        className={styles.delBtn}
                        onClick={() => remove(c.id)}
                        aria-label="Apagar comentário"
                      >
                        Apagar
                      </button>
                    )}
                  </div>
                  <p className={styles.body}>{c.body}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            placeholder={`Comentar sobre ${track.title}…`}
            value={draft}
            maxLength={2000}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => void submit()}
            disabled={!draft.trim() || posting}
            aria-label="Enviar comentário"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
              <path d="m21.854 2.147-10.94 10.939" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
