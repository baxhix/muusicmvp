import { cn } from '@/lib/utils';
import styles from './Avatar.module.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'away' | null;

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
}

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  src,
  name,
  size = 'md',
  status,
  className,
}: AvatarProps) {
  return (
    <span className={cn(styles.avatar, styles[size], className)} aria-label={name}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ''} className={styles.img} />
      ) : (
        <span>{initials(name)}</span>
      )}
      {status && <span className={cn(styles.statusDot, styles[status])} />}
    </span>
  );
}

export function AvatarGroup({
  users,
  max = 4,
  size = 'sm',
}: {
  users: Array<{ src?: string; name?: string }>;
  max?: number;
  size?: AvatarSize;
}) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <span className={styles.group}>
      {visible.map((u, i) => (
        <Avatar key={i} src={u.src} name={u.name} size={size} />
      ))}
      {overflow > 0 && <span className={styles.groupCount}>+{overflow}</span>}
    </span>
  );
}
