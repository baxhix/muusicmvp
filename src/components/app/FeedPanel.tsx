'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Stories from './Stories';
import AudioPost from './AudioPost';
import ActivityCard, { type ActivityCardData } from './ActivityCard';
import MediaPost, { type MediaPostData } from './MediaPost';
import { useAdminFeedPosts } from '@/hooks/useAdminFeedPosts';
import type { ApiFeedPost } from '@/lib/api/types';
import styles from './FeedPanel.module.css';

/* ── Activity cards data ─────────────────────────────────── */
const ACTIVITIES: ActivityCardData[] = [
  {
    type: 'co_listening',
    user: 'Camila',
    avatar: 'https://i.pravatar.cc/96?img=47',
    song: 'Boiadeira',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273148cc2bf987ec2f4964d49fa',
  },
  {
    type: 'chat_invite',
    user: 'Patrícia',
    avatar: 'https://i.pravatar.cc/96?img=44',
  },
  {
    type: 'liked',
    user: 'Daniel',
    avatar: 'https://i.pravatar.cc/96?img=12',
  },
  {
    type: 'message_request',
    user: 'Daniel',
    avatar: 'https://i.pravatar.cc/96?img=12',
    preview: 'Vi que você vai no Villa Country hoje? Tenho um par de ingressos sobrando…',
  },
];

/* ── Media posts data ───────────────────────────────────── */
const MEDIA: MediaPostData[] = [
  // Newest post first — FESPOP show. Photos shot live; same set
  // also flows through the Ana + Central chats (see fakeAna.ts).
  {
    type: 'carousel',
    user: 'Central Ana Castela',
    avatar: '/central-anacastela.png',
    time: '12min',
    likes: 7384,
    comments: 521,
    items: [
      { src: '/feed/ana-castela-fespop-1.png', alt: 'Ana Castela cantando no palco do FESPOP com chapéu AGROTHOMMY' },
      { src: '/feed/ana-castela-fespop-2.png', alt: 'Ana Castela sob o letreiro FESPOP com microfone' },
      { src: '/feed/ana-castela-fespop-3.png', alt: 'Ana Castela em close no palco com camisa branca bordada' },
      { src: '/feed/ana-castela-fespop-4.png', alt: 'Ana Castela cantando com luzes rosa ao fundo' },
    ],
  },
  {
    type: 'carousel',
    user: 'Central Ana Castela',
    avatar: '/central-anacastela.png',
    time: '8min',
    likes: 4821,
    comments: 312,
    items: [
      { src: '/feed/ana-castela-1.png', alt: 'Ana Castela no palco com microfone de glitter' },
      { src: '/feed/ana-castela-2.png', alt: 'Ana Castela cantando em trio no palco' },
      { src: '/feed/ana-castela-3.png', alt: 'Ana Castela em close, perfil de chapéu' },
      { src: '/feed/ana-castela-4.png', alt: 'Ana Castela e sanfoneiro em foto preto e branco' },
    ],
  },
  {
    type: 'video',
    user: 'Ana Castela',
    avatar: '/central-anacastela.png',
    time: '22min',
    likes: 9103,
    comments: 874,
    src: '/feed/simplesmente-acontece.mp4',
    // Poster reuses one of the carousel stills — same envelope, gives
    // the video a real first frame even before the file downloads.
    poster: '/feed/ana-castela-2.png',
  },
  {
    type: 'video',
    user: 'Ana Castela',
    avatar: '/central-anacastela.png',
    time: '1h',
    likes: 6240,
    comments: 412,
    src: '/feed/musica-vira-abraco.mp4',
    poster: '/feed/ana-castela-4.png',
  },
];

/* ── Admin → MediaPostData adapter ─────────────────────────
 * Bridge between the API shape (ApiFeedPost) and the renderer
 * shape (MediaPostData). Today admin posts are 'image' type so
 * we just split 1 image vs N images into image-vs-carousel.
 * When 'video' / 'story' types unlock on the admin side, extend
 * the switch — the rest of the feed plumbing already supports
 * them via the existing MediaPost variants. */
function relativeTime(iso: string): string {
  const dt = new Date(iso).getTime();
  const secs = Math.max(1, Math.floor((Date.now() - dt) / 1000));
  if (secs < 60) return 'agora';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;
  return `${Math.floor(days / 365)}a`;
}

function adminPostToMediaData(p: ApiFeedPost): MediaPostData | null {
  if (!p.media || p.media.length === 0) return null;
  // Stories surface in their own rail (see useAdminStories below),
  // never in the main feed.
  if (p.type === 'story') return null;
  const user = p.author?.name || 'Central Ana Castela';
  const avatar = p.author?.avatarUrl || '/central-anacastela.png';
  const time = relativeTime(p.publishedAt ?? p.createdAt);

  const base = {
    user,
    avatar,
    time,
    // Likes don't have a stored count yet (no likes table on the
    // server). MediaPost's local toggle adds +1 when the viewer
    // taps the hat — sufficient for the optimistic UX until a real
    // likes endpoint ships.
    likes: 0,
    // Real server-side count of non-deleted comments. Empty posts
    // render as `null` thanks to the count > 0 gate in MediaPost.
    comments: p.commentCount ?? 0,
    dbId: p.id,
    description: p.description ?? undefined,
  };

  // Video post — first media item with kind='video' is the canonical
  // clip; its poster (if set) becomes the thumbnail. Falls back to
  // image rendering when admin saved a 'video' type post without
  // ever uploading a clip (shouldn't happen due to server-side
  // validation, but defensive).
  if (p.type === 'video') {
    const video = p.media.find((m) => m.kind === 'video');
    if (video) {
      return {
        ...base,
        type: 'video' as const,
        src: video.url,
        poster: video.poster ?? undefined,
      };
    }
  }

  if (p.media.length === 1) {
    return {
      ...base,
      type: 'image' as const,
      src: p.media[0].url,
      alt: p.media[0].alt ?? undefined,
    };
  }
  return {
    ...base,
    type: 'carousel' as const,
    items: p.media.map((m) => ({ src: m.url, alt: m.alt ?? undefined })),
  };
}

/* ── Main component ──────────────────────────────────────── */
export default function FeedPanel() {
  // Feed lands expanded by default — was `true` (minimized), but the
  // expanded layout is now the resting view we want users to see first.
  // The header is still a toggle, so power users can collapse manually.
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Idle-scroll state: after 3s of no user interaction inside the
  // expanded feed, a "Novas publicações" banner fades in at the top
  // — purely informational, no auto-scroll behaviour anymore (was
  // pulling the page under users who were reading). Any wheel /
  // touch / mouse / scroll / keydown event resets the timer and
  // hides the banner.
  const [showIdleBanner, setShowIdleBanner] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  // Admin-CMS posts. Rendered at the top of the feed when present —
  // a flat list above the mock content so the team's real posts
  // lead. Falls back to just the mock content while loading or if
  // the fetch fails (the hook silently swallows non-401 errors).
  const { posts: adminPosts } = useAdminFeedPosts();
  const adminMedia = useMemo<MediaPostData[]>(() => {
    if (!adminPosts) return [];
    return adminPosts
      .map(adminPostToMediaData)
      .filter((m): m is MediaPostData => m !== null);
  }, [adminPosts]);

  /* Auto-scroll quando minimizado (jumping chunks every 3s). */
  useEffect(() => {
    if (!minimized) return;

    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;

      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
      if (nearBottom) {
        el.scrollTop = 0;
      } else {
        el.scrollBy({ top: 90, behavior: 'smooth' });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [minimized]);

  /* Idle banner trigger — "Novas publicações" surfaces at the top
   * of the feed after 3s without user input. Pure messaging now;
   * the previous auto-drift behaviour was pulling the page out
   * from under users mid-read and got removed per product
   * feedback. The banner still gives ambient feedback that there's
   * fresh content waiting.
   *
   * Skipped while minimized — the collapsed feed already has its
   * own chunked scroller above. */
  useEffect(() => {
    if (minimized) return;
    const el = scrollRef.current;
    if (!el) return;

    const markActive = () => {
      lastActivityRef.current = Date.now();
      setShowIdleBanner(false);
    };

    el.addEventListener('scroll',     markActive, { passive: true });
    el.addEventListener('wheel',      markActive, { passive: true });
    el.addEventListener('touchstart', markActive, { passive: true });
    el.addEventListener('touchmove',  markActive, { passive: true });
    el.addEventListener('mousemove',  markActive);
    el.addEventListener('keydown',    markActive);

    // Light polling (500ms) checks idle time. Faster than the
    // previous 80ms loop because we don't need scroll-tick
    // resolution anymore — just "have we crossed 3s of inactivity."
    const tick = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      setShowIdleBanner(idleMs >= 3000);
    }, 500);

    return () => {
      el.removeEventListener('scroll',     markActive);
      el.removeEventListener('wheel',      markActive);
      el.removeEventListener('touchstart', markActive);
      el.removeEventListener('touchmove',  markActive);
      el.removeEventListener('mousemove',  markActive);
      el.removeEventListener('keydown',    markActive);
      clearInterval(tick);
    };
  }, [minimized]);

  // External toggle hook — the right-rail chat dock dispatches an
  // `app:toggle-feed` CustomEvent so a click on the Feed shortcut
  // flips the panel between expanded / minimized without coupling
  // the two components directly. Mirrors the
  // `app:open-notifications` pattern in NotificationBell.
  //
  // We also listen to `app:close-feed`: page.tsx fires it when
  // opening the Chat panel (Chat + Feed share the right slot, so
  // Chat opening means Feed needs to collapse out of the way).
  useEffect(() => {
    const onToggle = () => setMinimized((m) => !m);
    const onForceClose = () => setMinimized(true);
    window.addEventListener('app:toggle-feed', onToggle);
    window.addEventListener('app:close-feed', onForceClose);
    return () => {
      window.removeEventListener('app:toggle-feed', onToggle);
      window.removeEventListener('app:close-feed', onForceClose);
    };
  }, []);

  return (
    <>
    {minimized && <div className={styles.minimizedGradient} />}
    <div className={`${styles.panel} ${minimized ? styles.panelMinimized : ''}`}>

      {/* Header */}
      <div
        className={styles.header}
        onClick={() => setMinimized(m => !m)}
        role="button"
        aria-label={minimized ? 'Maximizar feed' : 'Minimizar feed'}
      >
        <div className={styles.liveDot} />
        <span className={styles.title}>Feed</span>
      </div>

      {/* Idle "Novas publicações" banner — only fades in while the
          user has been inactive ≥3s AND the feed is expanded.
          Pointer-events disabled so it doesn't block clicks on the
          stories rail underneath. */}
      {!minimized && showIdleBanner && (
        <div className={styles.idleBanner} aria-hidden="true">
          <span>Novas publicações</span>
        </div>
      )}

      {/* Scroll */}
      <div className={styles.scroll} ref={scrollRef}>
        <Stories />
        <div className={styles.storiesDivider} />

        <AudioPost />
        <ActivityCard data={ACTIVITIES[0]} />

        {/* Admin-CMS posts published from /admin/feed lead the feed.
            Falls back to nothing while loading so the mock content
            still shows up if the team hasn't published anything yet. */}
        {adminMedia.map((m) => (
          <MediaPost key={m.dbId} data={m} />
        ))}

        <MediaPost data={MEDIA[0]} />
        <ActivityCard data={ACTIVITIES[1]} />
        <MediaPost data={MEDIA[1]} />
        <ActivityCard data={ACTIVITIES[2]} />
        <MediaPost data={MEDIA[2]} />
        <ActivityCard data={ACTIVITIES[3]} />

        {/* Repetição para o loop do scroll */}
        <Stories />
        <div className={styles.storiesDivider} />

        <AudioPost />
        <ActivityCard data={ACTIVITIES[2]} />
        <MediaPost data={MEDIA[2]} />
        <ActivityCard data={ACTIVITIES[0]} />
        <MediaPost data={MEDIA[1]} />
        <ActivityCard data={ACTIVITIES[3]} />
        <MediaPost data={MEDIA[0]} />
        <ActivityCard data={ACTIVITIES[1]} />
      </div>
    </div>
    </>
  );
}
