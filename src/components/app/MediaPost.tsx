'use client';

import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { awardPoints } from '@/lib/rewards';
import CommentsPanel from './CommentsPanel';
import VerifiedBadge from './VerifiedBadge';
import ShowAlbumCoverflow, { type ShowAlbumItem } from './ShowAlbumCoverflow';
import styles from './MediaPost.module.css';

/** Display name → verified flag. Centralized so the rule lives in
 *  one place; expand as more official accounts launch. Treats name
 *  comparisons case-insensitively and tolerates trailing whitespace. */
function isVerifiedCreator(name: string): boolean {
  const VERIFIED = new Set([
    'central ana castela',
    'ana castela',
  ]);
  return VERIFIED.has(name.trim().toLowerCase());
}

/* ── Types ──
 * `MediaPostData` covers BOTH the legacy mock feed (handcrafted
 * carousel/video entries from FeedPanel.tsx) AND admin-CMS posts
 * coming from `/api/feed/posts`. The two share enough rendering
 * surface that a single component covers them — the new `dbId`
 * field lets CommentsPanel attach to the real post row by id
 * instead of by mock-derived postKey. */
type BasePost = {
  user: string;
  avatar: string;
  time: string;
  likes: number;
  comments: number;
  /** Real `feed_posts.id` for CMS posts. Mock posts leave this off
   *  and rely on the derived postKey path. */
  dbId?: string;
  /** Optional caption/description below the media. Admin posts
   *  use this; mock posts leave it off. */
  description?: string;
  /** Optional title — usado pelo tipo `material_alert` como
   *  headline do card. Outros tipos ignoram. */
  title?: string;
};

export type ImagePostData    = BasePost & { type: 'image';  src: string; alt?: string };
// poster is now optional: admin-uploaded videos may not have a
// custom thumbnail. When omitted, the browser shows the first
// frame on its own (with `preload="metadata"`) which is fine
// for short clips and any video that doesn't open on a blank
// frame.
export type VideoPostData    = BasePost & { type: 'video';  poster?: string; src?: string };
export type CarouselPostData = BasePost & {
  type: 'carousel';
  /** Ordered list of slides — first one is shown by default. */
  items: { src: string; alt?: string }[];
};
/** YouTube post — `youtubeId` é o videoId extraído da URL no admin.
 *  O renderer embute via iframe nocookie pra reduzir tracking
 *  (privacy-enhanced mode). `youtubeUrl` mantida pra fallback /
 *  link "Abrir no YouTube". */
export type YoutubePostData  = BasePost & {
  type: 'youtube_video';
  youtubeId: string;
  youtubeUrl: string;
};
/** Material alert — post anunciando que tem material novo
 * exclusivo na aba Materiais do box Fanverse Ana Castela. Sem
 * mídia anexa; só title + description carregam o conteúdo, o
 * resto é visual (pasta com gradient + badge "Superfãs"). */
export type MaterialAlertPostData = BasePost & {
  type: 'material_alert';
};
/** Show album — álbum de fotos de um show específico,
 * apresentado num carousel estilo Apple Coverflow. Inclui
 * metadata do show (nome/venue/data) no `title` + lista
 * ordenada de fotos. O componente ShowAlbumCoverflow handle
 * o efeito 3D, navegação, zoom-view. */
export type ShowAlbumPostData = BasePost & {
  type: 'show_album';
  /** Subtítulo curto com venue + data (ex.: "Arena Fonte Nova,
   *  Salvador • 24/05"). Renderizado entre o description e o
   *  carousel. */
  showSubtitle?: string;
  /** Fotos do álbum — mínimo 1; recomendado 4-8 pro efeito
   *  3D fazer sentido. Ordem do array é a ordem de exibição. */
  items: ShowAlbumItem[];
};
export type MediaPostData    =
  | ImagePostData
  | VideoPostData
  | CarouselPostData
  | YoutubePostData
  | MaterialAlertPostData
  | ShowAlbumPostData;

/**
 * Extrai o videoId de uma URL de YouTube. Cobre os 3 formatos
 * canônicos:
 *   - https://www.youtube.com/watch?v=VIDEOID
 *   - https://youtu.be/VIDEOID
 *   - https://www.youtube.com/embed/VIDEOID
 *
 * Retorna null pra qualquer URL malformada — o renderer cai num
 * fallback de link em vez de iframe quebrado.
 */
export function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const v = u.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{6,}$/.test(v)) return v;
      /* /embed/VIDEOID e /shorts/VIDEOID. */
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && (parts[0] === 'embed' || parts[0] === 'shorts')) {
        const id = parts[1];
        return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

/* ── Icons ── */
const HeartIcon = () => (
  <svg viewBox="140 130 570 315" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M471.813,165.406c6.608,0,11.981,2.786,17.035,8.503l2.089,2.363l3.185,4.189l12.087,19.131
      c9.811,15.53,18.336,31.685,26.555,48.285l5.09,11.471c4.605,10.379,6.764,21.505,7.54,33.073l0.41,6.116l0.315,5.843l0.281,7.265
      l0.372,10.853l0.189,29.192c1.35,7.854,6.573,12.941,13.637,13.689c0.515,0.044,1.032,0.065,1.55,0.065
      c10.838,0,22.242-9.285,30.316-17.307l4.684-5.264l6.594-7.399l11.771-10.891l12.778-11.687c5.813-5.317,12.531-7.682,19.798-7.682
      c1.065,0,2.142,0.051,3.23,0.151c12.916,1.184,27.426,4.26,32.396,18.957c0.951,2.811,1.068,6.073,1.272,9.052l0.307,4.473
      l0.23,5.068l0.286,4.713l-0.072,38.611l-0.393,8.596c-0.38,8.308-7.694,13.145-14.813,13.274l-12.703,0.232l-2.82,0.289
      l-27.738,5.066c-28.356,5.844-56.578,10.17-85.176,12.697l-4.881,0.431l-4.49,0.373l-5.206,0.397l-5.512,0.391l-6.242,0.386
      l-5.384,0.317l-7.332,0.372l-9.633,0.397l-12.9,0.413l-58.453-0.007l-14.286-0.406l-11.021-0.397l-9.082-0.373l-8.592-0.408
      l-7.327-0.368l-5.729-0.323l-6.931-0.391l-6.235-0.375l-6.241-0.393l-5.889-0.384l-5.871-0.403l-4.849-0.381l-4.344-0.374
      l-4.667-0.402l-4.506-0.388l-4.505-0.387l-4.504-0.383l-4.85-0.406l-4.506-0.376l-4.85-0.403l-4.506-0.374l-4.85-0.402l-4.506-0.374
      l-4.851-0.403l-4.505-0.381l-4.505-0.389l-4.508-0.389l-4.157-0.378l-4.162-0.395l-3.814-0.371l-4.101-0.425l-13.722-1.657
      c-11.055-1.335-21.843-3.237-32.585-6.631c-7.188-2.272-14.019-3.972-21.455-4.64l-4.168-0.374
      c-3.638-0.327-7.086-0.531-10.672-1.725c-3.078-1.025-6.093-4.261-6.095-8.278l-0.035-65.23c-0.002-4.03,3.294-8.89,5.932-12.027
      c3.289-3.911,6.916-6.883,11.399-9.038c4.449-2.138,9.229-3.55,14.152-3.848l3.514-0.213l3.116,0.182
      c5.166,0.301,9.982,2.106,14.269,5.41c7.327,5.648,14.006,11.753,20.714,18.326l21.264,20.837c3.456,3.387,7.397,5.769,11.428,8.199
      c6.216,3.747,15.256,7.616,22.494,7.616c1.103,0,2.164-0.09,3.167-0.284c3.748-0.725,6.579-3.671,7.405-7.615
      c0.625-2.983,0.238-5.7,0.216-8.673l-0.232-30.538l-0.248-3.926l-0.264-4.674l-0.339-5.06l-0.348-5.448l0.035-9.618
      c0.957-12.815,6.523-24.79,12.583-35.624l9.761-17.451l13.81-22.227l18.681-30.327l7.984-11.66c2.755-4.023,7.547-5.35,12.279-5.35
      c1.289,0,2.572,0.098,3.81,0.267c8.413,1.15,16.579,4.202,23.193,10.207l5.998,6.455c2.573,2.77,6.134,4.169,9.728,4.169
      c2.472,0,4.96-0.662,7.153-1.996c1.488-0.906,3.094-1.285,4.719-1.285c1.713,0,3.448,0.421,5.094,1.092
      c2.465,1.005,4.751,1.807,6.81,1.807c2.25,0,4.228-0.958,5.874-3.659c0.916-1.503,2.08-3.174,3.281-4.392
      c6.957-7.062,13.972-11.901,23.517-13.276C469.336,165.5,470.596,165.406,471.813,165.406z"/>
  </svg>
);
const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4l14 8-14 8V4z"/>
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="3" width="4" height="18" rx="1.5"/>
    <rect x="15" y="3" width="4" height="18" rx="1.5"/>
  </svg>
);
const SoundOnIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6H1v4h2l4 3V3L3 6z"/>
    <path d="M11 5a4 4 0 010 6"/>
    <path d="M13.5 2.5a8 8 0 010 11"/>
  </svg>
);
const SoundOffIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6H1v4h2l4 3V3L3 6z"/>
    <path d="M13 5l-4 6M9 5l4 6"/>
  </svg>
);
const ChevronLeft = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3L5 8l5 5" />
  </svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3l5 5-5 5" />
  </svg>
);

/* ── Component ── */
/**
 * Derive a stable identifier for this post from its media. The
 * comments backend keys feed_posts by `post_key`, lazy-creating the
 * row on first interaction — see `getOrCreateFeedPost` in
 * `src/server/feed/comments.ts`. We don't include `time` / `user`
 * because both can drift while the same underlying media is still
 * the same post (e.g. relative time text refreshes on rerender).
 */
function postKeyFor(data: MediaPostData): string {
  // CMS posts: use the real DB id directly — no upsert needed
  // because the row already exists on the server side.
  if (data.dbId) return `feed:${data.dbId}`;
  if (data.type === 'image') return `media:image:${data.src}`;
  if (data.type === 'video') return `media:video:${data.src ?? data.poster}`;
  if (data.type === 'youtube_video') return `media:youtube:${data.youtubeId}`;
  if (data.type === 'material_alert') {
    // Sem mídia; usa title+user pra estabilizar entre renders.
    return `media:material:${data.user}:${data.title ?? ''}`;
  }
  if (data.type === 'show_album') {
    // Show albums têm título único por show; usa pra chave estável.
    return `media:show_album:${data.title ?? ''}:${data.items[0]?.src ?? ''}`;
  }
  // For carousels, the first slide's src is stable across rerenders.
  const first = data.items[0]?.src ?? data.user;
  return `media:carousel:${first}`;
}

export default function MediaPost({ data }: { data: MediaPostData }) {
  const [liked, setLiked]     = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted]     = useState(true);
  // Carousel-only: index of the visible slide. Living on the component
  // so each post owns its own state — multiple carousels in the same
  // feed advance independently.
  const [slideIdx, setSlideIdx] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Authoritative comment count. Seeded from the prop (which is
  // either the mock value or the real server count returned by
  // /api/feed/posts), then updated live by CommentsPanel whenever
  // the user creates / deletes a top-level OR a reply. We don't
  // rely on `data.comments` after mount because the prop is stale
  // once the user interacts.
  const [commentCount, setCommentCount] = useState<number>(data.comments);
  // Sync if the parent re-renders with a fresh post object
  // (e.g. admin posts hydrating after the initial fetch).
  useEffect(() => {
    setCommentCount(data.comments);
  }, [data.comments]);

  const postKey = postKeyFor(data);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) { setPlaying(p => !p); return; }
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (v) v.muted = !muted;
    setMuted(m => !m);
  };

  return (
    <div className={styles.card}>

      {/* Header */}
      <div className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.avatar} alt={data.user} className={styles.avatar} />
        <div className={styles.meta}>
          <div className={styles.name}>
            {data.user}
            {/* Verified badge on official accounts. For now the
             *  Central Ana Castela account is the only verified
             *  creator on the platform; widen this check as more
             *  official accounts onboard. */}
            {isVerifiedCreator(data.user) && (
              <VerifiedBadge size={13} className={styles.verifiedBadge} />
            )}
          </div>
          <div className={styles.time}>{data.time}</div>
        </div>
      </div>

      {/* Media */}
      {data.type === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.src}
          alt={data.alt ?? data.user}
          className={styles.image}
        />
      ) : data.type === 'carousel' ? (
        <CarouselMedia
          items={data.items}
          fallbackAlt={data.user}
          index={slideIdx}
          onChange={setSlideIdx}
        />
      ) : data.type === 'youtube_video' ? (
        /* YouTube embed via iframe (nocookie). Wrapper mantém o
         * aspect ratio 16:9 sem precisar de JS — `aspect-ratio` CSS
         * resolve. Reusa `.videoWrap` pro bg preto enquanto o
         * iframe ainda não carregou. */
        <div className={`${styles.videoWrap} ${styles.youtubeWrap}`}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${data.youtubeId}?rel=0&modestbranding=1`}
            title={data.description ?? 'YouTube video'}
            className={styles.youtubeFrame}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : data.type === 'material_alert' ? (
        /* Material alert — card de anúncio sem mídia. Pasta com
         * gradient (mesmo SVG da tab Materiais), badge "Exclusivo
         * superfãs" e CTA "Ver materiais" que dispara um evento pra
         * abrir o ArtistBox/MobileFanverseSheet na tab certa. */
        <MaterialAlertMedia
          title={data.title}
          description={data.description}
        />
      ) : data.type === 'show_album' ? (
        /* Show album — Apple Coverflow das fotos do show. Title
         *  + showSubtitle aparecem como header dentro do bloco
         *  pra dar contexto antes do carousel 3D. */
        <div>
          {(data.title || data.showSubtitle) && (
            <div className={styles.showAlbumHeader}>
              {data.title && (
                <h3 className={styles.showAlbumTitle}>{data.title}</h3>
              )}
              {data.showSubtitle && (
                <p className={styles.showAlbumSubtitle}>{data.showSubtitle}</p>
              )}
            </div>
          )}
          <ShowAlbumCoverflow
            items={data.items}
            title={data.title ?? 'Álbum do show'}
          />
        </div>
      ) : (
        <div className={styles.videoWrap}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            className={styles.video}
            poster={data.poster}
            src={data.src}
            loop
            muted={muted}
            playsInline
          />

          {/* Play/Pause overlay */}
          <button
            className={`${styles.playOverlay} ${playing ? styles.playing : ''}`}
            onClick={togglePlay}
            aria-label={playing ? 'Pausar' : 'Reproduzir'}
          >
            <span className={styles.playIcon}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </span>
          </button>

          {/* Mute */}
          <button
            className={styles.muteBtn}
            onClick={toggleMute}
            aria-label={muted ? 'Ativar som' : 'Mutar'}
          >
            {muted ? <SoundOffIcon /> : <SoundOnIcon />}
          </button>
        </div>
      )}

      {/* Optional caption — admin-CMS posts ship a `description`.
          Mock posts don't, so this collapses cleanly. Whitespace
          is preserved so multi-line drafts read like the admin
          composer rendered them. */}
      {data.description && (
        <div
          style={{
            padding: '10px 14px 0',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'rgba(245, 245, 247, 0.82)',
            letterSpacing: '-0.005em',
            whiteSpace: 'pre-wrap',
          }}
        >
          {data.description}
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {/* Hat (likes) — count is hidden when zero (or zero + not
            liked yet by current viewer). Once the local "liked"
            flag flips, we show the +1 even on a previously-zero
            post so the user gets immediate feedback. */}
        {(() => {
          const total = data.likes + (liked ? 1 : 0);
          return (
            <button
              className={`${styles.btn} ${styles.btnHat} ${liked ? styles.btnLiked : ''}`}
              onClick={() => {
                const next = !liked;
                setLiked(next);
                track(next ? 'feed_post_liked' : 'feed_post_unliked', {
                  post_id: data.dbId,
                  post_key: postKey,
                  creator_name: data.user,
                });
                // Engagement reward (+5 FP) — only on the toggle TO
                // liked. Untoggling doesn't refund or fire negative
                // points; the activity row stays as-is in the
                // ledger. POSTs to the like endpoint fire-and-forget
                // so the chapéu UX stays instant.
                if (next) {
                  void awardPoints('like', {
                    apiPath: `/api/feed/posts/${encodeURIComponent(postKey)}/like`,
                    analyticsContext: { post_id: data.dbId, post_key: postKey },
                  });
                }
              }}
              aria-label="Like"
            >
              <HeartIcon />
              {total > 0 ? total : null}
            </button>
          );
        })()}

        {/* Comment button — uses the live count (commentCount)
            that's updated by CommentsPanel via onCountChange.
            Hidden when zero so the icon doesn't sit next to a "0". */}
        <button
          className={`${styles.btn} ${commentsOpen ? styles.btnLiked : ''}`}
          onClick={() => setCommentsOpen((v) => !v)}
          aria-label={commentsOpen ? 'Fechar comentários' : 'Comentar'}
          aria-expanded={commentsOpen}
        >
          <CommentIcon />
          {commentCount > 0 ? commentCount : null}
        </button>

        <div className={styles.spacer} />

        <button
          className={styles.btn}
          onClick={() => {
            // Engagement reward (+15 FP) for share. No share-sheet
            // UX yet; the click just records the activity + fires
            // the toast. When the actual share affordance ships,
            // call awardPoints once the recipient is picked.
            void awardPoints('send', {
              apiPath: `/api/feed/posts/${encodeURIComponent(postKey)}/share`,
              analyticsContext: { post_id: data.dbId, post_key: postKey },
            });
          }}
          aria-label="Enviar mensagem"
        >
          <SendIcon />
          <span style={{ visibility: 'hidden', fontSize: '11px' }}>0</span>
        </button>
      </div>

      {/* Comments — lazy-mounted: the panel only fetches on first
          open, and toggling collapses the section without losing the
          loaded state. Sits inside the card so it inherits the same
          dark-gradient identity as the post header + media. */}
      <CommentsPanel
        postKey={postKey}
        initialCommentCount={data.comments}
        open={commentsOpen}
        onCountChange={setCommentCount}
      />
    </div>
  );
}

/* ── Material alert sub-component ────────────────────────────────────
 * Card visual usado pelo post `material_alert`. Pasta com gradient
 * orange→pink→purple (mesmo da tab Materiais), eyebrow "Exclusivo
 * superfãs" + headline + CTA. Click no CTA disparam o evento
 * `app:fanverse-open-materials` que o ArtistBox/MobileFanverseSheet
 * escutam pra abrir o box já na aba Materiais. */
function MaterialAlertMedia({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const headline = title?.trim() || 'Material novo exclusivo';
  const subline =
    description?.trim() ||
    'A Central de Fãs liberou um novo acervo na sua aba Materiais.';
  const openMaterials = () => {
    try {
      window.dispatchEvent(new CustomEvent('app:fanverse-open-materials'));
    } catch { /* SSR */ }
  };
  return (
    <div className={styles.materialAlert}>
      <span className={styles.materialBadge} aria-hidden="true">
        Exclusivo superfãs
      </span>
      <div className={styles.materialIconWrap} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" className={styles.materialIcon}>
          <defs>
            <linearGradient id="materialAlertGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <path
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
            fill="url(#materialAlertGradient)"
          />
        </svg>
      </div>
      <div className={styles.materialCopy}>
        <h3 className={styles.materialHeadline}>{headline}</h3>
        <p className={styles.materialSubline}>{subline}</p>
      </div>
      <button
        type="button"
        className={styles.materialCta}
        onClick={openMaterials}
      >
        Ver materiais
      </button>
    </div>
  );
}

/* ── Carousel sub-component ──────────────────────────────────────────
 * Single visible slide with prev/next chevrons and dot indicators.
 * The chevrons hide at boundaries (no wraparound) to match Instagram
 * behavior — the dots already tell the user where they are. State is
 * lifted to the parent so MediaPost owns the index, which keeps the
 * "actions" footer stable across slides. */
function CarouselMedia({
  items,
  fallbackAlt,
  index,
  onChange,
}: {
  items: { src: string; alt?: string }[];
  fallbackAlt: string;
  index: number;
  onChange: (next: number) => void;
}) {
  // Swipe gesture state. `dragX` is the live horizontal offset
  // (px) the finger has dragged the track since `pointerdown`;
  // it's applied as an inline `translateX(... + dragX px)` on top
  // of the index-based transform so the track follows the finger
  // in real time. `isDragging` lets us disable the CSS transition
  // during the drag — the snap (to the next slide OR back to the
  // current one) needs the transition re-enabled on release.
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (items.length === 0) return null;
  const safeIndex = Math.min(Math.max(index, 0), items.length - 1);
  const atStart = safeIndex === 0;
  const atEnd = safeIndex === items.length - 1;

  // Pointer events unify mouse + touch + pen so this gesture
  // works on every input mode without separate handlers. The
  // <img> children have `draggable={false}` AND `pointer-events:
  // none` (in CSS) so dragging never gets hijacked by the native
  // image-drag affordance — the gesture lives on the parent.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (items.length <= 1) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
    // Capture the pointer so we still receive move/up events even
    // if the finger leaves the carousel bounds mid-drag.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    // Edge rubber-band — past the first / last slide there's
    // nothing to reveal, so resist the drag (35% follow ratio)
    // instead of fully tracking. Same feel as iOS Photos.
    let bounded = dx;
    if ((atStart && dx > 0) || (atEnd && dx < 0)) {
      bounded = dx * 0.35;
    }
    setDragX(bounded);
  };
  const onPointerEnd = () => {
    if (startXRef.current === null) {
      setIsDragging(false);
      return;
    }
    const width = containerRef.current?.clientWidth ?? 1;
    // 25% of the carousel width is the commit threshold — past it
    // we advance/retreat one slide; under it we snap back to the
    // current slide. Felt-right value from iOS Photos / Instagram.
    const threshold = width * 0.25;
    if (dragX < -threshold && !atEnd) {
      onChange(safeIndex + 1);
    } else if (dragX > threshold && !atStart) {
      onChange(safeIndex - 1);
    }
    setDragX(0);
    setIsDragging(false);
    startXRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={styles.carousel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      // `pan-y` lets the browser keep handling vertical scrolling
      // natively while we claim horizontal pan for the swipe — no
      // accidental scroll-and-swipe conflict.
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className={styles.carouselTrack}
        style={{
          transform: `translateX(calc(${-safeIndex * 100}% + ${dragX}px))`,
          // Kill the CSS transition during the drag so the track
          // follows the finger 1:1. Releasing flips back to the
          // module's own `transition: transform 320ms` and the
          // track snaps to the new / current slide.
          transition: isDragging ? 'none' : undefined,
        }}
      >
        {items.map((slide, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={slide.src}
            alt={slide.alt ?? fallbackAlt}
            className={styles.carouselSlide}
            // Lazy-load slides beyond the first to save bandwidth when
            // the user never advances past slide 1.
            loading={i === 0 ? 'eager' : 'lazy'}
            draggable={false}
          />
        ))}
      </div>

      {!atStart && (
        <button
          type="button"
          className={`${styles.carouselNav} ${styles.carouselNavPrev}`}
          onClick={() => onChange(safeIndex - 1)}
          aria-label="Imagem anterior"
        >
          <ChevronLeft />
        </button>
      )}
      {!atEnd && (
        <button
          type="button"
          className={`${styles.carouselNav} ${styles.carouselNavNext}`}
          onClick={() => onChange(safeIndex + 1)}
          aria-label="Próxima imagem"
        >
          <ChevronRight />
        </button>
      )}

      <div className={styles.carouselDots} role="tablist" aria-label="Slides">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.carouselDot} ${i === safeIndex ? styles.carouselDotActive : ''}`}
            onClick={() => onChange(i)}
            aria-label={`Ir para imagem ${i + 1} de ${items.length}`}
            aria-current={i === safeIndex ? 'true' : undefined}
            role="tab"
          />
        ))}
      </div>

      <span className={styles.carouselCounter} aria-hidden="true">
        {safeIndex + 1}/{items.length}
      </span>
    </div>
  );
}
