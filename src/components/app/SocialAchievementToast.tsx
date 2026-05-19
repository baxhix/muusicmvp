'use client';

import {
  useAchievements,
  type SocialAchievement,
} from '@/hooks/useAchievements';
import styles from './SocialAchievementToast.module.css';

function actorLabel(a: SocialAchievement): string {
  if (a.userName?.trim()) return a.userName.trim();
  if (a.userEmail) return a.userEmail.split('@')[0];
  return 'Alguém';
}

function actorAvatar(a: SocialAchievement): string {
  return a.userAvatarUrl ?? '/avatar-placeholder.svg';
}

function formatPoints(points: number): string {
  if (points < 1000) return `${points} pontos`;
  return `${Math.round(points / 1000)} mil pontos`;
}

/**
 * Stack of small toasts in the upper-right that fire whenever any
 * user on the platform crosses a milestone. The hook caps the
 * queue at 4 in-flight items and auto-evicts each after ~4.5s.
 *
 * Distinct from the same-track toast (more discrete event), the
 * confetti celebration (self-only), and the SameTrack hover info —
 * achievement toasts are social proof of activity, surfaced to
 * everyone.
 */
export default function SocialAchievementToast() {
  const { socialAchievements } = useAchievements();
  if (socialAchievements.length === 0) return null;

  return (
    <div className={styles.stack} aria-live="polite">
      {socialAchievements.map((a) => (
        <div key={a._localId} className={styles.toast} role="status">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={actorAvatar(a)} alt="" className={styles.avatar} />
          <div className={styles.text}>
            <span className={styles.name}>{actorLabel(a)}</span>
            <span className={styles.body}>
              conquistou <strong>{formatPoints(a.points)}</strong>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
