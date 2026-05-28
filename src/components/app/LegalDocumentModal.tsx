'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './LegalDocumentModal.module.css';

export type LegalKind = 'terms_of_use' | 'privacy_policy';

interface LegalDoc {
  kind: LegalKind;
  title: string;
  body: string;
  version: number;
  publishedAt: string | null;
}

interface Props {
  open: boolean;
  kind: LegalKind;
  onClose: () => void;
}

/**
 * Modal in-app pra exibir Termos de Uso ou Política de Privacidade
 * SEM tirar o usuário do shell do /app.
 *
 *   - Trigger: itens "Termos de Uso" / "Política de Privacidade"
 *     na seção Legal do drawer do TopBar.
 *   - Conteúdo: vem de GET /api/legal/:kind (endpoint público).
 *     404 quando ainda não foi publicado → renderiza placeholder
 *     amigável em vez de error opaco.
 *   - Backdrop blur + scrim copiados da NotificationBell pra
 *     que a sensação seja a mesma de abrir Notificações da
 *     bottombar (per product feedback "mesmo efeito no fundo").
 *   - max-width 600px per product feedback.
 *
 * As páginas full-screen `/termos` e `/privacidade` continuam
 * existindo pro footer público + cadastro / onboarding (links
 * `target="_blank"`) — esse modal é só pro user logado dentro
 * do app.
 */
export default function LegalDocumentModal({ open, kind, onClose }: Props) {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  /* Mount guard pro createPortal — `document` só existe no client.
   * Sem isso, SSR/SSG falharia em pre-render porque o componente
   * é client-only mas o Next ainda tenta renderizar o JSX vazio. */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Fetch on open + kind change. Reset state quando fechar pra
   * que reabrir com OUTRO kind não mostre o conteúdo anterior
   * em flash. */
  useEffect(() => {
    if (!open) {
      setDoc(null);
      setNotFound(false);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setDoc(null);
    void (async () => {
      try {
        const res = await fetch(`/api/legal/${kind}`, { credentials: 'include' });
        if (!alive) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setError('Não foi possível carregar o documento.');
          return;
        }
        const data = (await res.json()) as { document: LegalDoc };
        setDoc(data.document);
      } catch (err) {
        console.error('legal modal fetch failed:', err);
        if (alive) setError('Falha de conexão. Tente de novo.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, kind]);

  /* Escape fecha — padrão consistente com outros modais. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const fallbackTitle =
    kind === 'terms_of_use' ? 'Termos de Uso' : 'Política de Privacidade';
  const publishedDate = doc?.publishedAt
    ? new Date(doc.publishedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return createPortal(
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-label={doc?.title ?? fallbackTitle}
      onClick={onClose}
    >
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <span className={styles.headerSpacer} aria-hidden="true" />
          <span className={styles.title}>{doc?.title ?? fallbackTitle}</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : notFound ? (
          <div className={styles.placeholder}>
            <h3>{fallbackTitle}</h3>
            <p>
              Estamos finalizando esse documento. Ele aparece aqui assim que
              o time publicar a primeira versão.
            </p>
          </div>
        ) : error ? (
          <div className={styles.body}>
            <div className={styles.errorBanner}>{error}</div>
          </div>
        ) : doc ? (
          <div className={styles.body}>
            {publishedDate && (
              <p className={styles.meta}>
                Versão <strong>v.{doc.version}</strong> · Atualizado em{' '}
                <strong>{publishedDate}</strong>
              </p>
            )}
            {doc.body}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
