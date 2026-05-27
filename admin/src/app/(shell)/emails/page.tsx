'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import MetricsTab from '@/components/emails/MetricsTab';
import LogsTab from '@/components/emails/LogsTab';
import TemplatesTab from '@/components/emails/TemplatesTab';
import BrandTab from '@/components/emails/BrandTab';
import styles from './page.module.css';

/**
 * E-mails — admin page.
 *
 * 4 tabs (ordem mantém Histórico no fim — é audit trail, não algo
 * que o admin precisa consultar primeiro):
 *   - Métricas:    KPIs e gráfico dos últimos 30 dias (default)
 *   - Templates:   edita subject/HTML dos emails do sistema.
 *                  Preview + teste.
 *   - Marca:       config global aplicada a todos os emails
 *                  (logo, footer, redes).
 *   - Histórico:   audit trail paginado de TODO envio (sent/failed).
 *
 * Tab "Campanhas" foi removida per product feedback "no admin,
 * remova o item Campanhas de Email". O CampaignsTab.tsx fica
 * dormindo no repo pra fácil reativação caso o produto volte a
 * pedir broadcasts por segmento, mas não é montado nem importado.
 *
 * Estado das tabs persiste via `?tab=...` query string —
 * deep-link da sidebar pra qualquer aba.
 */

type EmailsTab =
  | 'metricas'
  | 'templates'
  | 'marca'
  | 'historico';

const TABS: { id: EmailsTab; label: string }[] = [
  { id: 'metricas',   label: 'Métricas' },
  { id: 'templates',  label: 'Templates' },
  { id: 'marca',      label: 'Marca' },
  { id: 'historico',  label: 'Histórico' },
];

function EmailsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = (params.get('tab') as EmailsTab) ?? 'metricas';
  const [tab, setTab] = useState<EmailsTab>(tabParam);

  useEffect(() => {
    setTab(tabParam);
  }, [tabParam]);

  function changeTab(id: EmailsTab) {
    setTab(id);
    const q = new URLSearchParams(params.toString());
    q.set('tab', id);
    router.replace(`/emails?${q.toString()}`, { scroll: false });
  }

  return (
    <>
      <PageHeader
        title="E-mails"
        description="Templates do sistema, histórico de envios, métricas Resend e campanhas para segmentos de usuários."
      />

      <div className={styles.body}>
        <Tabs<EmailsTab>
          items={TABS}
          value={tab}
          onChange={changeTab}
          variant="bordered"
        />

        {tab === 'metricas'  && <MetricsTab />}
        {tab === 'historico' && <LogsTab />}
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'marca'     && <BrandTab />}
      </div>
    </>
  );
}

export default function EmailsPage() {
  // useSearchParams é client-only — Suspense pra Next 15 build.
  return (
    <Suspense fallback={null}>
      <EmailsPageInner />
    </Suspense>
  );
}
