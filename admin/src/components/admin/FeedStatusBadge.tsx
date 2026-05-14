import Badge, { type BadgeSize } from '@/components/ui/Badge';
import type { FeedItemStatus } from '@/types';

/**
 * Status pill for feed publications. Adds the two CMS-only states
 * (`scheduled`, `inactive`) that the generic StatusBadge doesn't
 * model. Stays a thin wrapper so the visual identity tracks
 * `Badge` exactly — the dot + tone vocabulary is identical to the
 * one used everywhere else in the admin.
 */
const MAP: Record<
  FeedItemStatus,
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger' }
> = {
  published: { label: 'Publicado',  tone: 'success' },
  scheduled: { label: 'Agendado',   tone: 'info'    },
  draft:     { label: 'Rascunho',   tone: 'neutral' },
  inactive:  { label: 'Inativo',    tone: 'warning' },
};

export default function FeedStatusBadge({
  status,
  size = 'md',
}: {
  status: FeedItemStatus | null;
  size?: BadgeSize;
}) {
  if (!status) {
    return (
      <Badge tone="neutral" size={size} dot>
        —
      </Badge>
    );
  }
  const cfg = MAP[status];
  return (
    <Badge tone={cfg.tone} size={size} dot>
      {cfg.label}
    </Badge>
  );
}
