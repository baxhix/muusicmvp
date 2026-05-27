import type { Metadata } from 'next';
import LegalDocumentPage from '@/components/legal/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Termos de Uso · Fanverse',
  description: 'Termos de Uso da plataforma Fanverse.',
};

/* Server component — busca o documento publicado a cada request.
 * Quando o admin publicar nova versão em /admin/site/lgpd, ela
 * aparece aqui imediatamente sem precisar invalidar cache.
 *
 * Linkado pelo footer público + drawer do TopBar logado + páginas
 * de auth (cadastro + onboarding) que pedem aceite.
 */
export default function TermosPage() {
  return (
    <LegalDocumentPage kind="terms_of_use" fallbackTitle="Termos de Uso" />
  );
}
