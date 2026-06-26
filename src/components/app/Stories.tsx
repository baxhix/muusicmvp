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
  /** Optional headline overlaid no topo do card (estilo Globo).
   *  Mock stories não têm; admin posts mapeiam do `title`. */
  caption?: string;
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
    caption: p.title ?? undefined,
  };
}

/**
 * Mock stories rendered when no admin-CMS stories are present.
 *
 * All entries belong to the same creator (Ana Castela) per product
 * decision — the name labels under each ring were already removed
 * in Stories.tsx render. Images live under /public/stories/ so they
 * ship with the build (no third-party CDN dependency for these
 * placeholders). The avatar reuses the existing
 * /public/central-anacastela.png we already serve elsewhere.
 *
 * To swap any of these previews: drop a new file at the same path
 * (public/stories/ana-{1..3}.png) — no code change needed.
 *
 * Slimmed from 5 → 3 entries per product feedback: only the
 * ana-1 / ana-2 / ana-3 previews surface in the rail now. The
 * ana-4.png + ana-5.png files stay in /public so re-adding entries
 * is trivial if the team wants to expand the rail again. */
const STORIES: Story[] = [
  {
    id: 's1',
    user: 'Ana Castela',
    avatar: '/central-anacastela.png',
    img: '/stories/ana-1.png',
    seen: false,
  },
  {
    id: 's2',
    user: 'Ana Castela',
    avatar: '/central-anacastela.png',
    img: '/stories/ana-2.png',
    seen: false,
  },
  {
    id: 's3',
    user: 'Ana Castela',
    avatar: '/central-anacastela.png',
    img: '/stories/ana-3.png',
    /* Marcado como "visto" pra demonstrar o anel cinza (traçado de
     * story já visualizado). Os demais ficam com o gradiente animado. */
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
  // Play/pause (botão do chrome desktop). Guardamos num ref pra
  // congelar o progresso sem reiniciar o intervalo a cada toggle.
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [muted, setMuted] = useState(true);
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
        if (pausedRef.current) return p; // pausado → congela o progresso
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

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };
  const jumpTo = (target: number) => {
    setIdx(target);
    setSlideIdx(0);
    setProgress(0);
  };
  const share = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        void navigator.share({ title: story.user, text: `Story de ${story.user}` });
      }
    } catch {
      /* usuário cancelou / não suportado */
    }
  };

  const canPrev = idx > 0 || slideIdx > 0;
  const canNext = idx < stories.length - 1 || slideIdx < slideCount - 1;

  // Cards vizinhos (até 2 de cada lado) — preview no formato carrossel
  // do desktop (estilo Globoesporte). Mais distante primeiro à esquerda,
  // mais próximo primeiro à direita; ficam escondidos no mobile via CSS.
  const leftPeeks = [2, 1]
    .map((d) => ({ i: idx - d, depth: d }))
    .filter((p) => p.i >= 0);
  const rightPeeks = [1, 2]
    .map((d) => ({ i: idx + d, depth: d }))
    .filter((p) => p.i < stories.length);

  const renderPeek = (p: { i: number; depth: number }) => (
    <button
      key={stories[p.i].id}
      className={`${styles.peek} ${p.depth === 2 ? styles.peekFar : ''}`}
      onClick={() => jumpTo(p.i)}
      aria-label={`Abrir story de ${stories[p.i].user}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stories[p.i].img} alt="" className={styles.peekImg} />
    </button>
  );

  return createPortal(
    <div className={styles.viewerOverlay} onClick={onClose}>

      {/* Fechar — chrome global (desktop). No mobile usa o X do header. */}
      <button className={styles.overlayClose} onClick={onClose} aria-label="Fechar">
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 4l10 10M14 4L4 14" />
        </svg>
      </button>

      {/* Controles à direita (desktop): mudo · play/pause · compartilhar */}
      <div className={styles.controlCol} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.ctrlBtn}
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Ativar som' : 'Silenciar'}
        >
          {muted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9h3l4-3v12l-4-3H4z" />
              <path d="M16 9l5 6M21 9l-5 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9h3l4-3v12l-4-3H4z" />
              <path d="M16 8.5a4 4 0 0 1 0 7" />
              <path d="M18.5 6a7 7 0 0 1 0 12" />
            </svg>
          )}
        </button>
        <button
          className={`${styles.ctrlBtn} ${styles.ctrlBtnPrimary}`}
          onClick={togglePause}
          aria-label={paused ? 'Reproduzir' : 'Pausar'}
        >
          {paused ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1.3" />
              <rect x="14" y="5" width="4" height="14" rx="1.3" />
            </svg>
          )}
        </button>
        <button className={styles.ctrlBtn} onClick={share} aria-label="Compartilhar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Palco em carrossel: cards vizinhos espreitando + card central. */}
      <div className={styles.stage}>
        <div className={`${styles.side} ${styles.sideLeft}`} onClick={(e) => e.stopPropagation()}>
          {leftPeeks.map(renderPeek)}
        </div>

        <div className={styles.center} onClick={(e) => e.stopPropagation()}>
          <button
            className={`${styles.navArrow} ${styles.navPrev}`}
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Anterior"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          </button>

          <div className={styles.viewerCard}>

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

            {/* Caption opcional (headline estilo Globo). */}
            {story.caption && <div className={styles.caption}>{story.caption}</div>}

            {/* Story slide. For multi-slide admin stories, the source
             *  follows the slide cursor. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentSlideUrl} alt={story.user} className={styles.viewerImg} />

            {/* Tap zones */}
            <button className={styles.tapLeft}  onClick={goPrev} aria-label="Anterior" />
            <button className={styles.tapRight} onClick={goNext} aria-label="Próximo"  />
          </div>

          <button
            className={`${styles.navArrow} ${styles.navNext}`}
            onClick={goNext}
            disabled={!canNext}
            aria-label="Próximo"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
          </button>
        </div>

        <div className={`${styles.side} ${styles.sideRight}`} onClick={(e) => e.stopPropagation()}>
          {rightPeeks.map(renderPeek)}
        </div>
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

  // Render-time duplication: with only 3 mock stories the rail
  // doesn't overflow the panel width on most viewports — so the
  // horizontal scroll affordance never lights up. Per product
  // feedback we duplicate the merged story list a few times in
  // the RENDER (not in the source state) so the rail comfortably
  // overflows and the touch-scroll experience is exercisable.
  // Click handlers map back to the original `stories[idx]` via
  // the `originalIdx` annotation below, so opening a duplicate
  // ring still shows the right content.
  const RAIL_REPEAT = 3;
  const railEntries = useMemo(() => {
    const out: Array<Story & { _key: string; _originalIdx: number; _isFirst: boolean }> = [];
    for (let r = 0; r < RAIL_REPEAT; r++) {
      stories.forEach((s, idx) => {
        out.push({
          ...s,
          _key: `${s.id}-r${r}`,
          _originalIdx: idx,
          // Only the very first ring in the rail (first occurrence
          // of the first story) gets the bigger 96px treatment.
          _isFirst: r === 0 && idx === 0,
        });
      });
    }
    return out;
  }, [stories]);

  return (
    <>
      <div className={styles.root}>
        {railEntries.map((story) => {
          const isFirst = story._isFirst;
          const size = isFirst ? 96 : 76;
          return (
            <button
              key={story._key}
              className={`${styles.storyBtn} ${isFirst ? styles.storyBtnFirst : ''}`}
              onClick={() => openViewer(story._originalIdx)}
              aria-label={`Story de ${story.user}`}
            >
              {/* Gradient ring */}
              <span
                className={`${styles.ring} ${story.seen ? styles.ringSeen : ''}`}
                style={{ width: size + 12, height: size + 12 }}
              >
                <span className={styles.ringInner} style={{ width: size + 6, height: size + 6 }}>
                  {/* Rail thumbnail uses the story's content image
                      (e.g. /stories/ana-1.png) per product feedback —
                      previously rendered `story.avatar` which was the
                      uniform central-anacastela.png for every entry,
                      so all three rings looked identical. Showing the
                      actual story image gives each preview its own
                      visual identity. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.img}
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
