'use client';

import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { IconCalendar } from '@/components/icons';

/**
 * Pre Save — admin tab for upcoming-release pre-save campaigns.
 *
 * Stub inicial per product feedback "crie um novo menu com o nome
 * de Pre save". Conteúdo real (lista de campanhas, link de
 * pre-save por faixa, contagem regressiva, exports) cai aqui
 * quando a spec correspondente fechar.
 */
export default function PreSavePage() {
  return (
    <>
      <PageHeader
        title="Pre Save"
        description="Campanhas de pre-save: usuários salvam a faixa na biblioteca antes do release e recebem o drop automaticamente."
      />

      <Card>
        <EmptyState
          icon={<IconCalendar size={20} />}
          title="Nenhuma campanha cadastrada"
          description="Crie uma nova campanha para gerar o link de pre-save da próxima faixa da Ana Castela. O fluxo de criação fica disponível assim que a integração com o catálogo de releases for ligada."
        />
      </Card>
    </>
  );
}
