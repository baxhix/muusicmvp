import PlaceholderPage from '@/components/ui/PlaceholderPage';
import Button from '@/components/ui/Button';
import { IconPlus } from '@/components/icons';

export default function FeedPage() {
  return (
    <PlaceholderPage
      title="Feed"
      description="Listagem de todos os conteúdos publicados na plataforma — posts, áudios, vídeos e imagens."
      actions={
        <Button variant="primary" size="sm" leadingIcon={<IconPlus size={14} />}>
          Novo destaque
        </Button>
      }
      scope={[
        { label: 'Tabela paginada com posts (autor, tipo, status, métricas, data)', meta: 'DataTable' },
        { label: 'Filtros: tipo de conteúdo · criador · data · status', meta: 'Toolbar' },
        { label: 'Ações em massa (aprovar, remover, destacar)', meta: 'Bulk' },
        { label: 'Preview do conteúdo em sheet lateral', meta: 'Drawer' },
        { label: 'Métricas inline por post (likes, plays, comentários)', meta: 'StatusBadge' },
      ]}
    />
  );
}
