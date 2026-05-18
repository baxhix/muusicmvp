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
  { title: "Lets Go Rodeo", artist: 'Ana Castela' },
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
    case 'listening_together':
      return (
        <>
          {/* 3 stacked mini-avatars convey "many people" without
            * needing a real avatar source. Same image set the
            * other notifications use so the visual reads as a
            * coherent system. */}
          <div className={styles.avatarStack} aria-hidden="true">
            <img
              src={MOCK_USERS[0].avatar}
              alt=""
              className={styles.avatarStackItem}
            />
            <img
              src={MOCK_USERS[2].avatar}
              alt=""
              className={styles.avatarStackItem}
            />
            <img
              src={MOCK_USERS[4].avatar}
              alt=""
              className={styles.avatarStackItem}
            />
          </div>
          <div className={styles.info}>
            <span className={styles.text}>
              <strong className={styles.strong}>
                +{toast.count.toLocaleString('pt-BR')} pessoas
              </strong>{' '}
              ouvindo com você
            </span>
            <span className={styles.track}>
              <span className={styles.audioBars} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </span>
              <span className={styles.trackLabel}>ao mesmo tempo, agora</span>
            </span>
          </div>
        </>
      );

    case 'message_sent':
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={toast.user.avatar} alt="" className={styles.avatar} />
          <div className={styles.info}>
            <span className={styles.text}>
              <strong className={styles.strong}>{toast.user.name}</strong>{' '}
              enviou uma mensagem
            </span>
            <span className={styles.track}>
              <svg
                viewBox="0 0 24 24"
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
              </svg>
              <span className={styles.trackLabel}>
                Toque pra abrir o chat
              </span>
            </span>
          </div>
        </>
      );

    case 'waved':
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={toast.user.avatar} alt="" className={styles.avatar} />
          <div className={styles.info}>
            <span className={styles.text}>
              <strong className={styles.strong}>{toast.user.name}</strong>{' '}
              acenou pra você
            </span>
            <span className={styles.track}>
              <span className={styles.waveEmoji} aria-hidden="true">
                👋
              </span>
              <span className={styles.trackLabel}>Mande um aceno de volta</span>
            </span>
          </div>
        </>
      );

    case 'top_track':
      return (
        <>
          {/* Music-themed glyph stands in for the avatar slot —
            * keeps the row geometry consistent across types. */}
          <span className={styles.glyph} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
          <div className={styles.info}>
            <span className={styles.text}>
              <strong className={styles.strong}>{toast.track.title}</strong>{' '}
              é a sua mais ouvida
            </span>
            <span className={styles.track}>
              <span className={styles.audioBars} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </span>
              <span className={styles.trackLabel}>{toast.track.artist}</span>
            </span>
          </div>
        </>
      );

    case 'top_20':
      return (
        <>
          {/* Crown glyph signals ranking — same icon family used
            * in the Fanpoints surface so the visual language ties
            * back to the existing rewards loop. */}
          <span className={styles.glyph} aria-hidden="true">
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
          </span>
          <div className={styles.info}>
            <span className={styles.text}>
              Você está no{' '}
              <strong className={styles.strong}>TOP {toast.rank}</strong> de
              fãs
            </span>
            <span className={styles.track}>
              <span className={styles.trackLabel}>
                Continue ouvindo pra subir
              </span>
            </span>
          </div>
        </>
      );
  }
}
