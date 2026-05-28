import type { Metadata } from 'next';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Política de Privacidade · Fanverse',
  description: 'Política de Privacidade da plataforma Fanverse.',
};

/* Server component — busca o documento publicado a cada request.
 * Quando o admin publicar nova versão em /admin/site/lgpd, ela
 * aparece aqui imediatamente sem precisar invalidar cache.
 *
 * Linkado pelo footer público + drawer do TopBar logado + páginas
 * de auth (cadastro + onboarding) que pedem aceite. */
export default function PrivacidadePage() {
  return (
    <LegalDocumentPage
      kind="privacy_policy"
      surface="site"
      fallbackTitle="Política de Privacidade"
    />
  );
}
