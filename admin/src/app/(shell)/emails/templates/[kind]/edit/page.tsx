'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TemplateEditorFull from '@/components/emails/TemplateEditorFull';
import { emailsService, type EmailTemplate } from '@/services/emails';

interface PageProps {
  params: Promise<{ kind: string }>;
}

/**
 * Editor full-page de um template.
 *
 * Carrega TODOS os templates (lista é bounded — <20 entries) e
 * filtra pelo `kind` da URL. Se não achar, redireciona pra lista.
 *
 * Por que não GET single: lista é pequena e a tab Templates já
 * carregou tudo em memória — refresh aqui só repete um round-trip
 * leve, vs adicionar mais uma rota REST que precisa de manutenção.
 */
export default function TemplateEditPage({ params }: PageProps) {
  const { kind } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<EmailTemplate | null | 'not-found'>(
    null,
  );

  useEffect(() => {
    let cancel = false;
    emailsService.templates
      .list()
      .then((res) => {
        if (cancel) return;
        const found = res.items.find((t) => t.kind === kind);
        setTemplate(found ?? 'not-found');
      })
      .catch(() => {
        if (cancel) return;
        setTemplate('not-found');
      });
    return () => {
      cancel = true;
    };
  }, [kind]);

  useEffect(() => {
    if (template === 'not-found') {
      router.replace('/emails?tab=templates');
    }
  }, [template, router]);

  if (template === null) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: 14,
        }}
      >
        Carregando template…
      </div>
    );
  }

  if (template === 'not-found') {
    return null;
  }

  return <TemplateEditorFull template={template} />;
}
