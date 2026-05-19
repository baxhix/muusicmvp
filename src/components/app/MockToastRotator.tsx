'use client';

import { useEffect, useState } from 'react';
import styles from './MockToastRotator.module.css';

/* ============================================================
 * MOCK TOAST ROTATOR — cycling demo notifications
 *
 * Replaces the previous `ListeningTogether` avatar cascade. The
 * rotator cycles through a fixed pool of mock notifications,
 * presenting each as a single horizontal pill that slides up
 * from below the viewport, holds for a few seconds, slides out,
 * and the next entry takes its place after a short gap.
 *
 * The visual matches `SameTrackToast` / `PointsToast` — same
 * pill envelope, same animations, same screen position — so the
 * rotator reads as one of those real notifications even though
 * everything here is hard-coded mock data.
 *
 * Notification types:
 *   1. listening_together — "+455 pessoas ouvindo com você"
 *   2. message_sent       — "Beatriz K. enviou uma mensagem"
 *   3. waved              — "Lucas M. acenou para você"
 *   4. top_track          — "Pipoco é a sua mais ouvida"
 *   5. top_20             — "Você está no TOP 20!"
 *
 * Per product feedback "Use dados mocados por hora" — the data
 * stays fixed across the session; the cadence is what gives the
 * illusion of a steady stream of platform activity arriving.
 * ============================================================ */

interface MockUser {
  name: string;
  avatar: string;
}

const MOCK_USERS: MockUser[] = [
  { name: 'Beatriz K.', avatar: 'https://i.pravatar.cc/72?img=47' },
  { name: 'Rafael S.', avatar: 'https://i.pravatar.cc/72?img=12' },
  { name: 'Lucas M.', avatar: 'https://i.pravatar.cc/72?img=33' },
  { name: 'Ana C.', avatar: 'https://i.pravatar.cc/72?img=56' },
  { name: 'Thiago F.', avatar: 'https://i.pravatar.cc/72?img=8' },
  { name: 'Paula G.', avatar: 'https://i.pravatar.cc/72?img=44' },
];

const MOCK_TRACKS = [
  { title: 'Pipoco', artist: 'Ana Castela' },
  { title: 'Boiadeira', artist: 'Ana Castela' },
  // "Lets Go Rodeo" was previously listed as a track here, but
  // it's the ALBUM name, not a song — replaced with another
  // Ana Castela single per product feedback.
  { title: 'Solteiro Forçado', artist: 'Ana Castela' },
];

type MockToast =
  | { kind: 'listening_together'; count: number }
  | { kind: 'message_sent'; user: MockUser }
  | { kind: 'waved'; user: MockUser }
  | { kind: 'top_track'; track: { title: string; artist: string } }
  | { kind: 'top_20'; rank: number };

/**
 * Pre-baked rotation order. Each tick advances by one; the array
 * wraps so the same sequence repeats. The `+455` listening pill
 * is interleaved between the other types per product feedback
 * ("intercale ... com outras notificações").
 */
const ROTATION: MockToast[] = [
  { kind: 'listening_together', count: 455 },
  { kind: 'message_sent', user: MOCK_USERS[0] },
  { kind: 'waved', user: MOCK_USERS[2] },
  { kind: 'listening_together', count: 482 },
  { kind: 'top_track', track: MOCK_TRACKS[0] },
  { kind: 'message_sent', user: MOCK_USERS[1] },
  { kind: 'top_20', rank: 18 },
  { kind: 'listening_together', count: 471 },
  { kind: 'waved', user: MOCK_USERS[4] },
  { kind: 'top_track', track: MOCK_TRACKS[1] },
  { kind: 'message_sent', user: MOCK_USERS[3] },
  { kind: 'listening_together', count: 493 },
  { kind: 'top_20', rank: 12 },
  { kind: 'waved', user: MOCK_USERS[5] },
  { kind: 'top_track', track: MOCK_TRACKS[2] },
];

/** ms each toast holds visible before exiting. */
const HOLD_MS = 5200;
/** ms for the exit animation — must match `.toastExit` keyframe duration. */
const EXIT_MS = 400;
/** ms of empty space between one toast leaving and the next entering. */
const GAP_MS = 1100;
/** ms for the enter animation — must match `.toastEnter` keyframe. */
const ENTER_MS = 420;

type Phase = 'enter' | 'hold' | 'exit' | 'gap';

export default function MockToastRotator() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('enter');

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === 'enter') {
      t = setTimeout(() => setPhase('hold'), ENTER_MS);
    } else if (phase === 'hold') {
      t = setTimeout(() => setPhase('exit'), HOLD_MS);
    } else if (phase === 'exit') {
      t = setTimeout(() => setPhase('gap'), EXIT_MS);
    } else {
      t = setTimeout(() => {
        setIdx((i) => (i + 1) % ROTATION.length);
        setPhase('enter');
      }, GAP_MS);
    }
    return () => clearTimeout(t);
  }, [phase]);

  // During the gap, the pill is fully off-screen — render nothing
  // so even the empty container can't intercept pointer events.
  if (phase === 'gap') return null;

  const current = ROTATION[idx];
  const exiting = phase === 'exit';

  return (
    <div className={styles.root} aria-live="polite">
      <div
        className={`${styles.toast} ${exiting ? styles.toastExit : styles.toastEnter}`}
        role="status"
      >
        <ToastBody toast={current} />
      </div>
    </div>
  );
}

function ToastBody({ toast }: { toast: MockToast }) {
  switch (toast.kind) {
    case 'listening_together': {
      // Cascade reveal: each subsequent avatar staggers in by
      // 140ms (driven by `--avatar-i` in CSS) so the stack lands
      // one-by-one — the same "users surgindo um por cima do
      // outro" animation the previous ListeningTogether had.
      // 3 avatars per product feedback (was 4 → reduced by 1 so
      // the audio-bar animation comfortably fits inline on the
      // same row as the text). Avatars are sized smaller than
      // the standardized 36px avatar slot (24px each) to make
      // room for the row to stay single-line.
      const cascadeAvatars = [
        MOCK_USERS[0],
        MOCK_USERS[2],
        MOCK_USERS[4],
      ];
      return (
        <>
          <div className={styles.avatarStack} aria-hidden="true">
            {cascadeAvatars.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={u.name}
                src={u.avatar}
                alt=""
                className={styles.avatarStackItem}
                style={{ ['--avatar-i' as string]: i } as React.CSSProperties}
              />
            ))}
          </div>
          <div className={styles.info}>
            <span className={styles.text}>
              <strong className={styles.strong}>
                +{toast.count.toLocaleString('pt-BR')} pessoas
              </strong>{' '}
              ouvindo com você
            </span>
            <span className={styles.audioBars} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
          </div>
        </>
      );
    }

    case 'message_sent':
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={toast.user.avatar} alt="" className={styles.avatar} />
          {/* Single-line variant per product feedback: the
            * "Toque pra abrir o chat" CTA row was removed,
            * leaving just the actor + action sentence. */}
          <div className={`${styles.info} ${styles.infoSingleLine}`}>
            <span className={styles.text}>
              <strong className={styles.strong}>{toast.user.name}</strong>{' '}
              enviou uma mensagem
            </span>
          </div>
        </>
      );

    case 'waved':
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={toast.user.avatar} alt="" className={styles.avatar} />
          <div className={`${styles.info} ${styles.infoSingleLine}`}>
            {/* Single-line variant per product feedback: just the
              * actor + "acenou para você" + a waving-hand emoji.
              * The previous CTA ("Mande um aceno de volta") was
              * removed to keep the row minimal. */}
            <span className={styles.text}>
              <strong className={styles.strong}>{toast.user.name}</strong>{' '}
              acenou para você{' '}
              <span className={styles.waveEmojiInline} aria-hidden="true">
                👋
              </span>
            </span>
          </div>
        </>
      );

    case 'top_track':
      return (
        <>
          {/* Album cover in the standardized 36px avatar slot. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/single.png"
            alt=""
            className={styles.avatar}
            aria-hidden="true"
          />
          {/* Single-line layout to match every other notification
            * type. The artist-name subtitle was dropped — it was
            * always "Ana Castela" in this mock pool anyway, and
            * keeping the line meant the row was taller than the
            * standardized height. Audio bars sit inline next to
            * the text. */}
          <div className={styles.info}>
            <span className={styles.text}>
              <strong className={styles.strong}>{toast.track.title}</strong>{' '}
              é a sua mais ouvida
            </span>
            <span className={styles.audioBars} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
          </div>
        </>
      );

    case 'top_20':
      return (
        <>
          {/* Crown glyph signals ranking — same icon family used
            * in the Fanpoints surface so the visual language ties
            * back to the existing rewards loop. Wrapped in a
            * `.glyphFestive` container that paints CSS-only
            * confetti particles around the crown — 8 small dots
            * popping outward in a celebration burst keyframe. */}
          <span
            className={`${styles.glyph} ${styles.glyphFestive}`}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 19h19l-1.5-9-5 3.5L12 6l-3 7.5L4 10l-1.5 9z" />
            </svg>
            {/* Confetti particles — 8 spans positioned around
              * the glyph via :nth-child rules in CSS. Each
              * particle has its own delay so the burst feels
              * staggered. */}
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
            <span className={styles.confettiPiece} />
          </span>
          {/* Single-line variant per product feedback: the
            * "Continue ouvindo pra subir" subtitle was removed,
            * leaving just the ranking line + the festive crown
            * + confetti glyph. */}
          <div className={`${styles.info} ${styles.infoSingleLine}`}>
            <span className={styles.text}>
              Você está no{' '}
              <strong className={styles.strong}>TOP {toast.rank}</strong> de
              fãs
            </span>
          </div>
        </>
      );
  }
}
