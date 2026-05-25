'use client';

import PageHeader from '@/components/ui/PageHeader';
import FanpointsView from '@/components/admin/FanpointsView';
import styles from './page.module.css';

/**
 * Fanpoints — promovido a página dedicada na nova IA da sidebar
 * (item dentro do grupo "Superfãs"). Antes vivia como tab dentro
 * de Configurações.
 */
export default function FanpointsPage() {
  return (
    <>
      <PageHeader
        title="Fanpoints"
        description="Regras de pontuação: cada comportamento integrado credita pontos em runtime. Edite o valor direto na tabela — propaga em até 60s entre instâncias."
      />
      <div className={styles.body}>
        <FanpointsView />
      </div>
    </>
  );
}
