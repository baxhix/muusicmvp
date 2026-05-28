import Link from 'next/link';
import {
  getPublishedLegalDocument,
  type LegalDocumentKind,
  type LegalDocumentSurface,
} from '@/server/admin/legal';
import styles from './LegalDocumentPage.module.css';

interface Props {
  kind: LegalDocumentKind;
  /** Surface do documento — pra esse component (páginas
   *  públicas /termos e /privacidade) sempre é 'site'. App e
   *  plataforma têm consumers próprios. */
  surface: LegalDocumentSurface;
  /** Fallback exibido no header (e no placeholder) quando ainda
   *  não há nenhuma versão publicada. */
  fallbackTitle: string;
}

/**
 * Render server-side de um documento legal publicado.
 *
 *   - Busca a row diretamente via `getPublishedLegalDocument`
 *     (ignora rascunhos).
 *   - Quando não há nada publicado, mostra um placeholder
 *     amigável em vez de 404 — o link já pode estar em produção
 *     antes da primeira publicação real.
 *   - `white-space: pre-wrap` no `.body` preserva os parágrafos
 *     digitados no admin sem precisar de parser de markdown.
 *
 * Server-component puro — re-renderiza a cada request, então
 * uma publicação no admin aparece imediatamente no site público
 * sem invalidação manual de cache.
 */
export default async function LegalDocumentPage({
  kind,
  surface,
  fallbackTitle,
}: Props) {
  const doc = await getPublishedLegalDocument(kind, surface);

  if (!doc) {
    return (
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.backLink} href="/">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3 5 8l5 5" />
            </svg>
            Voltar
          </Link>
        </header>
        <main className={styles.main}>
          <div className={styles.placeholder}>
            <h1>{fallbackTitle}</h1>
            <p>
              Estamos finalizando esse documento. Ele aparece aqui assim que
              o time publicar a primeira versão.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const publishedDate = doc.publishedAt
    ? new Date(doc.publishedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
          Voltar
        </Link>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{doc.title}</h1>
        {publishedDate && (
          <p className={styles.meta}>
            Versão <strong>v.{doc.version}</strong> · Atualizado em{' '}
            <strong>{publishedDate}</strong>
          </p>
        )}
        <article className={styles.body}>{doc.body}</article>
      </main>
    </div>
  );
}
