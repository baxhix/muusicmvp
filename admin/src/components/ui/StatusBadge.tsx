import Badge, { type BadgeSize, type BadgeTone } from './Badge';

export type StatusKey =
  // user statuses
  | 'active'
  | 'suspended'
  | 'banned'
  | 'pending'
  // post statuses
  | 'published'
  | 'draft'
  | 'review'
  | 'removed'
  // moderation
  | 'open'
  | 'resolved'
  | 'dismissed'
  | 'escalated';

const MAP: Record<StatusKey, { label: string; tone: BadgeTone }> = {
  active:    { label: 'Ativo',       tone: 'success' },
  suspended: { label: 'Suspenso',    tone: 'warning' },
  banned:    { label: 'Banido',      tone: 'danger' },
  pending:   { label: 'Pendente',    tone: 'neutral' },
  published: { label: 'Publicado',   tone: 'success' },
  draft:     { label: 'Rascunho',    tone: 'neutral' },
  review:    { label: 'Em análise',  tone: 'warning' },
  removed:   { label: 'Removido',    tone: 'danger' },
  open:      { label: 'Aberta',      tone: 'warning' },
  resolved:  { label: 'Resolvida',   tone: 'success' },
  dismissed: { label: 'Dispensada',  tone: 'neutral' },
  escalated: { label: 'Escalada',    tone: 'danger' },
};

export default function StatusBadge({
  status,
  size = 'md',
}: {
  status: StatusKey;
  size?: BadgeSize;
}) {
  const cfg = MAP[status];
  return (
    <Badge tone={cfg.tone} size={size} dot>
      {cfg.label}
    </Badge>
  );
}
