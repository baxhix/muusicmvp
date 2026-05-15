'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAdminStories } from '@/hooks/useAdminStories';
import type { ApiFeedPost } from '@/lib/api/types';
import styles from './Stories.module.css';

export interface Story {
  id: string;
  user: string;
  avatar: string;
  /** First/lead media url shown on the ring + as initial slide in
   *  the viewer. */
  img: string;
  seen: boolean;
  /** Full slide list for admin-authored stories. The mock content
   *  has a single slide; admin posts may have up to 10 (one per
   *  uploaded image). */
  slides?: { url: string; alt?: string | null }[];
}

/** Adapt an admin post (type='story') to the Story shape consumed
 *  by the rail + viewer. */
function adminStoryToStory(p: ApiFeedPost): Story | null {
  if (!p.media || p.media.length === 0) return null;
  const author = p.author?.name || 'Central Ana Castela';
  const avatar = p.author?.avatarUrl || '/central-anacastela.png';
  return {
    id: `admin-${p.id}`,
    user: author,
    avatar,
    img: p.media[0].url,
    seen: false,
    slides: p.media.map((m) => ({ url: m.url, alt: m.alt })),
  };
}

const STORIES: Story[] = [
  {
    id: 's1',
    user: 'Ana Castela',
    avatar: 'https://i.scdn.co/image/ab67616d0000b273148cc2bf987ec2f4964d49fa',
    img: 'https://images.unsplash.com/photo-1501386761578-eaa54b4e9f8a?w=800&q=80',
    seen: false,
  },
  {
    id: 's2',
    user: 'Gusttavo Lima',
    avatar: 'https://i.pravatar.cc/96?img=11',
    img: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
    seen: false,
  },
  {
    id: 's3',
    user: 'Wesley Safadão',
    avatar: 'https://i.pravatar.cc/96?img=22',
    img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
    seen: false,
  },
  {
    id: 's4',
    user: 'Simone & Simaria',
    avatar: 'https://i.pravatar.cc/96?img=45',
    img: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80',
    seen: true,
  },
  {
    id: 's5',
    user: 'Marília M.',
    avatar: 'https://i.pravatar.cc/96?img=35',
    img: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80',
    seen: true,
  },
  {
    id: 's6',
    user: 'Zé Neto & Cris',
    avatar: 'https://i.pravatar.cc/96?img=60',
    img: 'https://images.unsplash.com/photo-1468234560867-5cb522c3f00a?w=800&q=80',
    seen: true,
  },
];

/* ── Viewer ──────────────────────────────────────────────── */
function Viewer({
  stories,
  startIdx,
  onClose,
  onSeen,
}: {
  stories: Story[];
  startIdx: number;
  onClose: () => void;
  onSeen: (id: string) => void;
}) {
  const [idx, setIdx]       = useState(startIdx);
  /** Slide cursor WITHIN the current story. Admin-authored stories
   *  can have multiple slides (one per uploaded image); mock
   *  stories have a single slide. */
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 5000; // ms per slide
  const TICK = 50;

  const story = stories[idx];
  const slideCount = Math.max(1, story.slides?.length ?? 1);
  const currentSlideUrl = story.slides?.[slideIdx]?.url ?? story.img;

  const goNext = () => {
    // Advance within story first; only roll over to the next story
    // when we exhaust the current slide list.
    if (slideIdx < slideCount - 1) {
      setSlideIdx((s) => s + 1);
      setProgress(0);
      return;
    }
    if (idx < stories.length - 1) {
      setIdx((i) => i + 1);
      setSlideIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  };
  const goPrev = () => {
    if (slideIdx > 0) {
      setSlideIdx((s) => s - 1);
      setProgress(0);
      return;
    }
    if (idx > 0) {
      setIdx((i) => i - 1);
      setSlideIdx(0);
      setProgress(0);
    }
  };

  // Reset slide cursor whenever we move to a new story.
  useEffect(() => {
    setSlideIdx(0);
  }, [idx]);

  useEffect(() => {
    onSeen(story.id);
    setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        const next = p + (TICK / DURATION) * 100;
        if (next >= 100) { clearInterval(intervalRef.current!); goNext(); return 100; }
        return next;
      });
    }, TICK);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, slideIdx]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div className={styles.viewerOverlay} onClick={onClose}>
      <div className={styles.viewerCard} onClick={e => e.stopPropagation()}>

        {/* Progress bars. Each STORY gets its own row that
         *  subdivides into one bar per SLIDE — single-slide stories
         *  still render exactly one bar so the mock content is
         *  unchanged. */}
        <div className={styles.progressRow}>
          {stories.flatMap((s, storyI) => {
            const segments = Math.max(1, s.slides?.length ?? 1);
            return Array.from({ length: segments }).map((_, segI) => {
              const before = storyI < idx || (storyI === idx && segI < slideIdx);
              const current = storyI === idx && segI === slideIdx;
              return (
                <div key={`${s.id}:${segI}`} className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: before ? '100%' : current ? `${progress}%` : '0%' }}
                  />
                </div>
              );
            });
          })}
        </div>

        {/* Header */}
        <div className={styles.viewerHeader}>
          <div className={styles.viewerUser}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={story.avatar} alt={story.user} className={styles.viewerAvatar} />
            <span className={styles.viewerName}>{story.user}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2"
                 strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14"/>
            </svg>
          </button>
        </div>

        {/* Story slide. For multi-slide admin stories, the source
         *  follows the slide cursor. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={currentSlideUrl} alt={story.user} className={styles.viewerImg} />

        {/* Tap zones */}
        <button className={styles.tapLeft}  onClick={goPrev} aria-label="Anterior" />
        <button className={styles.tapRight} onClick={goNext} aria-label="Próximo"  />
      </div>
    </div>,
    document.body
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function Stories() {
  // Admin-authored stories lead the rail; mock content trails so
  // the rail never looks empty before the API resolves.
  const { stories: adminPosts } = useAdminStories();
  const adminStories = useMemo<Story[]>(
    () =>
      adminPosts
        .map(adminStoryToStory)
        .filter((s): s is Story => s !== null),
    [adminPosts],
  );

  // Merge admin → mock once on each adminStories change. We keep
  // local `seen` state so the user's clicks stick even while the
  // admin list re-fetches.
  const [stories, setStories] = useState<Story[]>(STORIES);
  useEffect(() => {
    setStories((prev) => {
      // Preserve seen flags from the previous merge for items whose
      // id still exists.
      const seenById = new Map(prev.map((s) => [s.id, s.seen]));
      const merged = [
        ...adminStories.map((s) => ({ ...s, seen: seenById.get(s.id) ?? false })),
        ...STORIES.map((s) => ({ ...s, seen: seenById.get(s.id) ?? s.seen })),
      ];
      return merged;
    });
  }, [adminStories]);

  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const openViewer = (idx: number) => setViewerIdx(idx);
  const closeViewer = () => setViewerIdx(null);
  const markSeen = (id: string) =>
    setStories(prev => prev.map(s => s.id === id ? { ...s, seen: true } : s));

  return (
    <>
      <div className={styles.root}>
        {stories.map((story, idx) => {
          const isFirst = idx === 0;
          const size = isFirst ? 96 : 76;
          return (
            <button
              key={story.id}
              className={`${styles.storyBtn} ${isFirst ? styles.storyBtnFirst : ''}`}
              onClick={() => openViewer(idx)}
              aria-label={`Story de ${story.user}`}
            >
              {/* Gradient ring */}
              <span
                className={`${styles.ring} ${story.seen ? styles.ringSeen : ''}`}
                style={{ width: size + 8, height: size + 8 }}
              >
                <span className={styles.ringInner} style={{ width: size + 2, height: size + 2 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.avatar}
                    alt={story.user}
                    className={styles.avatar}
                    style={{ width: size, height: size }}
                  />
                </span>
              </span>
              {/* Story names removed — every story belongs to the same
                  creator (Central Ana Castela), so repeating the label
                  under each ring was visual noise. The aria-label on
                  the button still carries the name for screen readers. */}
            </button>
          );
        })}
      </div>

      {viewerIdx !== null && (
        <Viewer
          stories={stories}
          startIdx={viewerIdx}
          onClose={closeViewer}
          onSeen={markSeen}
        />
      )}
    </>
  );
}
