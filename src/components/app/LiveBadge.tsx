'use client';

import styles from './LiveBadge.module.css';
import type { LiveBadgeData, BadgePositionSet } from '@/types';

function AvatarInner({ badge }: { badge: LiveBadgeData }) {
  if (badge.img) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={badge.img} alt={badge.name} className={styles.avatarImg} />
    );
  }
  return (
    <div className={styles.avatar} style={{ background: badge.bg }}>
      <span>{badge.initials}</span>
    </div>
  );
}

interface PulseDotProps {
  style: React.CSSProperties;
}

export function PulseDot({ style }: PulseDotProps) {
  return <div className={styles.pulseDot} style={style} aria-hidden="true" />;
}

interface LiveBadgeLayerProps {
  badges: LiveBadgeData[];
  positions: BadgePositionSet[];
  onBadgeClick?: (badge: LiveBadgeData) => void;
}

export function LiveBadgeLayer({ badges, positions, onBadgeClick }: LiveBadgeLayerProps) {
  return (
    <>
      {badges.map((badge, i) => (
        <div
          key={badge.id}
          className={styles.badge}
          style={{ left: positions[i]?.left, top: positions[i]?.top }}
          onClick={() => onBadgeClick?.(badge)}
        >
          <AvatarInner badge={badge} />
          <div className={styles.info}>
            <span className={styles.name}>{badge.name}</span>
            <span className={styles.song}>
              <span className={styles.audio} aria-hidden="true">
                <span /><span /><span />
              </span>
              {badge.song}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}
