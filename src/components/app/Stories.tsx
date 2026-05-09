'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Stories.module.css';

export interface Story {
  id: string;
  user: string;
  avatar: string;
  img: string;
  seen: boolean;
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
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 5000; // ms per story
  const TICK = 50;

  const story = stories[idx];

  const goNext = () => {
    if (idx < stories.length - 1) { setIdx(i => i + 1); setProgress(0); }
    else onClose();
  };
  const goPrev = () => {
    if (idx > 0) { setIdx(i => i - 1); setProgress(0); }
  };

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
  }, [idx]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div className={styles.viewerOverlay} onClick={onClose}>
      <div className={styles.viewerCard} onClick={e => e.stopPropagation()}>

        {/* Progress bars */}
        <div className={styles.progressRow}>
          {stories.map((s, i) => (
            <div key={s.id} className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
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

        {/* Story image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={story.img} alt={story.user} className={styles.viewerImg} />

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
  const [stories, setStories] = useState<Story[]>(STORIES);
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
              <span className={styles.storyName}>{story.user}</span>
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
