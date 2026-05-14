'use client';

import { useState, useEffect, useRef } from 'react';
import Stories from './Stories';
import AudioPost from './AudioPost';
import ActivityCard, { type ActivityCardData } from './ActivityCard';
import MediaPost, { type MediaPostData } from './MediaPost';
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

/* ── Main component ──────────────────────────────────────── */
export default function FeedPanel() {
  const [minimized, setMinimized] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll quando minimizado */
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

      {/* Scroll */}
      <div className={styles.scroll} ref={scrollRef}>
        <Stories />
        <div className={styles.storiesDivider} />

        <AudioPost />
        <ActivityCard data={ACTIVITIES[0]} />
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
