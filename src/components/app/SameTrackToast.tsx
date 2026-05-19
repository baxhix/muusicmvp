'use client';

import { useEffect, useState } from 'react';
import { useSameTrackToasts, type SameTrackToastPayload } from '@/hooks/useSameTrackToasts';
import styles from './SameTrackToast.module.css';

const EXIT_MS = 380;
const HOLD_MS = 6000;

/** Display label for the source (name or email local-part). */
function sourceLabel(t: SameTrackToastPayload): string {
  if (t.sourceName?.trim()) return t.sourceName.trim();
  if (t.sourceEmail) return t.sourceEmail.split('@')[0];
  return 'Alguém';
}

function avatarSrc(t: SameTrackToastPayload): string {
  return t.sourceAvatarUrl ?? '/avatar-placeholder.svg';
}

/**
 * One toast pill — manages its own exit phase locally (60ms before the
 * hook removes it from the queue) so the slide-down animation has time
 * to play before unmount.
 */
function ToastRow({ t }: { t: SameTrackToastPayload }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Trigger exit shortly before the hook removes us, so the animation
    // is visible. The hook's dismiss timeout is HOLD_MS; we start the
    // exit transition (HOLD_MS - EXIT_MS) into the lifetime.
    const id = setTimeout(() => setExiting(true), HOLD_MS - EXIT_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className={`${styles.toast} ${exiting ? styles.toastExit : styles.toastEnter}`}
      role="status"
      aria-live="polite"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarSrc(t)}
        alt=""
        className={styles.avatar}
      />
      <div className={styles.info}>
        <span className={styles.text}>
          <strong className={styles.strong}>{sourceLabel(t)}</strong> está ouvindo
        </span>
        <span className={styles.track}>
          <span className={styles.audioBars} aria-hidden="true">
            <span /><span /><span /><span />
          </span>
          <span className={styles.trackLabel}>
            <strong className={styles.strong}>{t.trackTitle}</strong> — {t.trackArtist}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Renders the live queue of same-track toasts just above the bottom nav.
 * Each toast slides in from below, holds 6s, slides out. Multiple toasts
 * stack vertically if they overlap.
 */
export default function SameTrackToast() {
  const { toasts } = useSameTrackToasts();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.root} aria-label="Notificações de mesma música">
      {toasts.slice(-3).map((t) => (
        <ToastRow key={t.id} t={t} />
      ))}
    </div>
  );
}
