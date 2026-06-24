'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  LEGAL_DRAWER_EVENT,
  type LegalKind,
  type LegalSurface,
  type OpenLegalDetail,
} from '@/lib/legal/legalDrawerBus';
import styles from './LegalDrawer.module.css';

interface LegalDoc {
  kind: LegalKind;
  title: string;
  body: string;
  version: number;
  publishedAt: string | null;
}

/**
 * LegalDrawer — drawer LATERAL (desliza da direita) pra exibir
 * Termos de Uso / Política de Privacidade sem tirar o usuário da
 * página. Montado UMA vez no root layout; abre via o evento
 * `LEGAL_DRAWER_EVENT` (disparado por `openLegalDrawer()` /
 * `<LegalLink />`).
 *
 * Entra e sai com animação (AnimatePresence do motion): scrim
 * faz fade, o painel desliza no eixo X. Respeita
 * prefers-reduced-motion. Conteúdo vem de GET
 * /api/legal/:surface/:kind (público); 404 → placeholder "em
 * breve".
 */
export default function LegalDrawer() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<LegalKind>('terms_of_use');
  const [surface, setSurface] = useState<LegalSurface>('site');
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => setMounted(true), []);

  // Mobile (<=640px) → bottom-sheet (desliza de baixo); desktop →
  // drawer lateral (desliza da direita). matchMedia só no client.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Escuta o evento de abertura disparado de qualquer lugar.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenLegalDetail>).detail;
      if (!detail) return;
      setKind(detail.kind);
      setSurface(detail.surface);
      setOpen(true);
    };
    window.addEventListener(LEGAL_DRAWER_EVENT, handler);
    return () => window.removeEventListener(LEGAL_DRAWER_EVENT, handler);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // Busca o documento quando abre / muda kind / muda surface.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setDoc(null);
    void (async () => {
      try {
        const res = await fetch(`/api/legal/${surface}/${kind}`, {
          credentials: 'include',
        });
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
      } catch {
        if (alive) setError('Falha de conexão. Tente de novo.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, kind, surface]);

  // Escape fecha + trava o scroll do body enquanto aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  if (!mounted) return null;

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
    <AnimatePresence>
      {open && (
        <motion.div
          key="legal-scrim"
          className={styles.scrim}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReduced ? 0 : 0.28, ease: 'easeOut' }}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={doc?.title ?? fallbackTitle}
        >
          <motion.aside
            className={styles.panel}
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={
              prefersReduced
                ? { duration: 0 }
                : { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.4 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <header className={styles.header}>
              <span className={styles.title}>{doc?.title ?? fallbackTitle}</span>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={close}
                aria-label="Fechar"
              >
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className={styles.content}>
              {loading ? (
                <div className={styles.loading}>Carregando…</div>
              ) : notFound ? (
                <div className={styles.placeholder}>
                  <h3>{fallbackTitle}</h3>
                  <p>
                    Estamos finalizando esse documento. Ele aparece aqui assim
                    que o time publicar a primeira versão.
                  </p>
                </div>
              ) : error ? (
                <div className={styles.errorBanner}>{error}</div>
              ) : doc ? (
                <>
                  {publishedDate && (
                    <p className={styles.meta}>
                      Versão <strong>v.{doc.version}</strong> · Atualizado em{' '}
                      <strong>{publishedDate}</strong>
                    </p>
                  )}
                  <div className={styles.body}>{doc.body}</div>
                </>
              ) : null}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
