'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import Input from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { IconAlert, IconCheck, IconSend } from '@/components/icons';
import {
  LEGAL_LABELS,
  legalService,
  type LegalDocument,
  type LegalDocumentKind,
} from '@/services/legal';
import styles from './page.module.css';

/**
 * /admin/site/lgpd — editor de Termos de Uso + Política de
 * Privacidade.
 *
 * Tabs alternam entre os 2 documentos. Cada um tem:
 *   - Título editável (default "Termos de Uso" / "Política de
 *     Privacidade").
 *   - Body em textarea monoespaçado (markdown plano por enquanto;
 *     editor rich-text fica pra v2).
 *   - Status badge: Publicado v.X / Rascunho (mudanças salvas
 *     mas não publicadas) / Nunca publicado.
 *   - Salvar — guarda em rascunho (não altera site público).
 *   - Salvar e publicar — bumpa version + grava publishedAt;
 *     site público pega na próxima requisição.
 *
 * O "dirty" indicator avisa quando há mudanças não salvas, e o
 * Publicar exige confirmação porque é a ação que afeta páginas
 * legais que usuários consentem.
 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LgpdAdminPage() {
  const [activeTab, setActiveTab] = useState<LegalDocumentKind>('terms_of_use');
  const [docs, setDocs] = useState<Record<LegalDocumentKind, LegalDocument | null>>({
    terms_of_use: null,
    privacy_policy: null,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* ── Draft state (não-persistido até o user clicar Salvar) ── */
  type DraftState = { title: string; body: string };
  const [drafts, setDrafts] = useState<Record<LegalDocumentKind, DraftState>>({
    terms_of_use: { title: '', body: '' },
    privacy_policy: { title: '', body: '' },
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);

  /* ── Initial load ──────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { items } = await legalService.list();
        if (!alive) return;
        const next: Record<LegalDocumentKind, LegalDocument | null> = {
          terms_of_use: null,
          privacy_policy: null,
        };
        const nextDrafts: Record<LegalDocumentKind, DraftState> = {
          terms_of_use: { title: '', body: '' },
          privacy_policy: { title: '', body: '' },
        };
        for (const item of items) {
          next[item.kind] = item;
          nextDrafts[item.kind] = { title: item.title, body: item.body };
        }
        setDocs(next);
        setDrafts(nextDrafts);
      } catch (err) {
        console.error('legal load failed:', err);
        if (alive) setLoadError('Não foi possível carregar os documentos.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const current = docs[activeTab];
  const draft = drafts[activeTab];

  /* dirty = draft difere da row persistida */
  const isDirty = useMemo(() => {
    if (!current) return false;
    return draft.title !== current.title || draft.body !== current.body;
  }, [current, draft]);

  const setDraft = useCallback(
    (next: Partial<DraftState>) => {
      setDrafts((cur) => ({
        ...cur,
        [activeTab]: { ...cur[activeTab], ...next },
      }));
    },
    [activeTab],
  );

  /* ── Save (rascunho) ───────────────────────────────────── */
  const handleSave = useCallback(async () => {
    if (!current || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      const { document } = await legalService.save(activeTab, {
        title: draft.title.trim() || undefined,
        body: draft.body,
      });
      setDocs((cur) => ({ ...cur, [activeTab]: document }));
      /* Reset draft pra refletir o que voltou do servidor — title
       * pode ter sofrido .trim() no backend, body sempre confere. */
      setDrafts((cur) => ({
        ...cur,
        [activeTab]: { title: document.title, body: document.body },
      }));
    } catch (err) {
      console.error('legal save failed:', err);
      setActionError('Não foi possível salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }, [current, saving, activeTab, draft]);

  /* ── Publish (bumpa version + grava publishedAt) ────────── */
  const handlePublish = useCallback(async () => {
    if (!current || publishing) return;
    setPublishing(true);
    setActionError(null);
    setConfirmPublishOpen(false);
    try {
      const { document } = await legalService.publish(activeTab, {
        title: draft.title.trim() || undefined,
        body: draft.body,
      });
      setDocs((cur) => ({ ...cur, [activeTab]: document }));
      setDrafts((cur) => ({
        ...cur,
        [activeTab]: { title: document.title, body: document.body },
      }));
    } catch (err) {
      console.error('legal publish failed:', err);
      setActionError('Não foi possível publicar. Tente de novo.');
    } finally {
      setPublishing(false);
    }
  }, [current, publishing, activeTab, draft]);

  const statusBadge = useMemo(() => {
    if (!current) return null;
    if (current.publishedAt === null) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusUnpublished}`}>
          Nunca publicado
        </span>
      );
    }
    if (isDirty) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusDraft}`}>
          Rascunho não publicado
        </span>
      );
    }
    return (
      <span className={`${styles.statusBadge} ${styles.statusPublished}`}>
        Publicado v.{current.version}
      </span>
    );
  }, [current, isDirty]);

  return (
    <>
      <PageHeader
        title="LGPD"
        description="Termos de uso e política de privacidade — documentos legais publicados nas páginas públicas /termos e /privacidade."
      />
      <div className={styles.body}>
        {loadError && (
          <div className={styles.errorBanner}>
            <IconAlert size={14} /> {loadError}
          </div>
        )}

        <div className={styles.tabsRow}>
          <Tabs<LegalDocumentKind>
            items={[
              { id: 'terms_of_use', label: LEGAL_LABELS.terms_of_use },
              { id: 'privacy_policy', label: LEGAL_LABELS.privacy_policy },
            ]}
            value={activeTab}
            onChange={(id) => {
              /* Se o user tem rascunho não salvo na tab atual,
               * NÃO perde — o state dos drafts é por-kind então
               * trocar de tab preserva. Só restauramos do server
               * em casos explícitos (descartar via Reload). */
              setActiveTab(id);
              setActionError(null);
            }}
            variant="bordered"
          />
        </div>

        {loading ? (
          <div className={styles.loading}>Carregando documentos…</div>
        ) : current ? (
          <Card>
            <div className={styles.docCard}>
              <div className={styles.docHeader}>
                <div className={styles.docTitleBlock}>
                  <h3 className={styles.docTitle}>{LEGAL_LABELS[activeTab]}</h3>
                  <span className={styles.docMeta}>
                    {current.publishedAt ? (
                      <>
                        Última publicação:{' '}
                        <strong>{formatDate(current.publishedAt)}</strong>
                      </>
                    ) : (
                      <>Atualizado: <strong>{formatDate(current.updatedAt)}</strong></>
                    )}
                  </span>
                </div>
                {statusBadge}
              </div>

              {actionError && (
                <div className={styles.errorBanner}>
                  <IconAlert size={14} /> {actionError}
                </div>
              )}

              <Input
                label="Título"
                value={draft.title}
                onChange={(e) => setDraft({ title: e.target.value })}
                maxLength={160}
                placeholder={LEGAL_LABELS[activeTab]}
                disabled={saving || publishing}
                helperText="Aparece como título da página pública."
              />

              <div>
                <label
                  htmlFor={`legal-body-${activeTab}`}
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(245,245,247,0.85)',
                    marginBottom: 6,
                  }}
                >
                  Conteúdo
                </label>
                <textarea
                  id={`legal-body-${activeTab}`}
                  className={styles.editor}
                  value={draft.body}
                  onChange={(e) => setDraft({ body: e.target.value })}
                  placeholder={
                    activeTab === 'terms_of_use'
                      ? 'Termos de Uso — defina as regras de uso da plataforma…'
                      : 'Política de Privacidade — explique quais dados são coletados, como são usados…'
                  }
                  disabled={saving || publishing}
                  maxLength={200_000}
                />
                <p className={styles.editorHint}>
                  Texto plano por enquanto (Markdown será renderizado nas páginas
                  públicas em uma fase seguinte). Quebras de linha são preservadas.
                </p>
              </div>

              <div className={styles.actions}>
                <div className={styles.actionsLeft}>
                  {isDirty && (
                    <span className={styles.dirtyDot}>Mudanças não salvas</span>
                  )}
                </div>
                <div className={styles.actionsRight}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleSave()}
                    disabled={!isDirty || saving || publishing}
                    loading={saving}
                    leadingIcon={<IconCheck size={14} />}
                  >
                    Salvar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setConfirmPublishOpen(true)}
                    disabled={saving || publishing}
                    loading={publishing}
                    leadingIcon={<IconSend size={14} />}
                  >
                    Publicar
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmPublishOpen}
        onClose={() => setConfirmPublishOpen(false)}
        onConfirm={() => void handlePublish()}
        title={`Publicar ${LEGAL_LABELS[activeTab]}?`}
        description={
          current?.publishedAt
            ? `O conteúdo atual virará a versão ${current.version + 1} e aparecerá imediatamente na página pública. Usuários verão a versão nova ao próximo acesso.`
            : `Isso publica a primeira versão e a página pública passa a renderizar o conteúdo. Garanta que está revisado antes de confirmar.`
        }
        confirmLabel="Publicar agora"
        cancelLabel="Cancelar"
        loading={publishing}
      />
    </>
  );
}
