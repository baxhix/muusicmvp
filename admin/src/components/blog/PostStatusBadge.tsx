import Badge, { type BadgeSize, type BadgeTone } from '@/components/ui/Badge';
import type { BlogPostStatus } from '@/types/blog';

/** Mapeia status do post pro tone do Badge do design system.
 *  Mantido em arquivo próprio porque vai ser reusado em vários
 *  lugares (listagem, editor, sidebar lateral do editor). */
const TONE: Record<BlogPostStatus, BadgeTone> = {
  draft:     'neutral',
  scheduled: 'info',
  published: 'success',
  archived:  'warning',
};

const LABEL: Record<BlogPostStatus, string> = {
  draft:     'Rascunho',
  scheduled: 'Agendado',
  published: 'Publicado',
  archived:  'Arquivado',
};

export default function PostStatusBadge({
  status,
  size = 'md',
}: {
  status: BlogPostStatus;
  /** Default `md` pra alinhar com StatusBadge/FeedStatusBadge
   *  (tamanho padrão do design system). Override pra `sm` em
   *  contextos densos se precisar. */
  size?: BadgeSize;
}) {
  return (
    <Badge tone={TONE[status]} size={size} dot>
      {LABEL[status]}
    </Badge>
  );
}

export { LABEL as POST_STATUS_LABEL };
