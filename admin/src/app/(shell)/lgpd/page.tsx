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
  LEGAL_KIND_LABELS,
  LEGAL_KINDS_ORDER,
  LEGAL_SURFACE_DESCRIPTIONS,
  LEGAL_SURFACE_LABELS,
  LEGAL_SURFACES_ORDER,
  legalService,
  type LegalDocument,
  type LegalDocumentKind,
  type LegalDocumentSurface,
} from '@/services/legal';
import styles from './page.module.css';

/**
 * /admin/lgpd — editor de Termos de Uso + Política de Privacidade
 * POR surface (site, app, plataforma web).
 *
 * Dois eixos:
 *
 *   - Surface row (chips lilás no topo): "Site", "App",
 *     "Plataforma web". Cada chip representa onde o documento
 *     aparece pro usuário final. Cada surface tem fluxo de
 *     publicação independente.
 *
 *   - Kind tabs (bordered abaixo): "Termos de Uso" / "Política
 *     de Privacidade". Trocar kind preserva o draft da surface
 *     atual; trocar surface preserva o draft naquele kind.
 *
 * Total: 6 documentos editáveis (2 kinds × 3 surfaces). State
 * de draft é mantido em memória por chave `kind:surface`, então
 * trocar de aba não perde edições não salvas.
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

type DraftKey = `${LegalDocumentKind}:${LegalDocumentSurface}`;
type DraftState = { title: string; body: string };

function key(
  kind: LegalDocumentKind,
  surface: LegalDocumentSurface,
): DraftKey {
  return `${kind}:${surface}`;
}

export default function LgpdAdminPage() {
  const [activeSurface, setActiveSurface] =
    useState<LegalDocumentSurface>('site');
  const [activeKind, setActiveKind] =
    useState<LegalDocumentKind>('terms_of_use');

  const [docs, setDocs] = useState<Record<DraftKey, LegalDocument | null>>(
    () => {
      const init: Record<string, LegalDocument | null> = {};
      for (const s of LEGAL_SURFACES_ORDER) {
        for (const k of LEGAL_KINDS_ORDER) init[key(k, s)] = null;
      }
      return init as Record<DraftKey, LegalDocument | null>;
    },
  );
  const [drafts, setDrafts] = useState<Record<DraftKey, DraftState>>(() => {
    const init: Record<string, DraftState> = {};
    for (const s of LEGAL_SURFACES_ORDER) {
      for (const k of LEGAL_KINDS_ORDER) {
        init[key(k, s)] = { title: '', body: '' };
      }
    }
    return init as Record<DraftKey, DraftState>;
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);

  /* ── Initial load — lista todos os 6 documentos ─────────── */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { items } = await legalService.list();
        if (!alive) return;
        const nextDocs: Record<string, LegalDocument | null> = {};
        const nextDrafts: Record<string, DraftState> = {};
        for (const s of LEGAL_SURFACES_ORDER) {
          for (const k of LEGAL_KINDS_ORDER) {
            nextDocs[key(k, s)] = null;
            nextDrafts[key(k, s)] = { title: '', body: '' };
          }
        }
        for (const item of items) {
          const dk = key(item.kind, item.surface);
          nextDocs[dk] = item;
          nextDrafts[dk] = { title: item.title, body: item.body };
        }
        setDocs(nextDocs as Record<DraftKey, LegalDocument | null>);
        setDrafts(nextDrafts as Record<DraftKey, DraftState>);
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

  const currentKey = key(activeKind, activeSurface);
  const current = docs[currentKey];
  const draft = drafts[currentKey];

  const isDirty = useMemo(() => {
    if (!current) return false;
    return draft.title !== current.title || draft.body !== current.body;
  }, [current, draft]);

  const setDraft = useCallback(
    (next: Partial<DraftState>) => {
      setDrafts((cur) => ({
        ...cur,
        [currentKey]: { ...cur[currentKey], ...next },
      }));
    },
    [currentKey],
  );

  /* ── Save (rascunho) ───────────────────────────────────── */
  const handleSave = useCallback(async () => {
    if (!current || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      const { document } = await legalService.save(
        activeSurface,
        activeKind,
        {
          title: draft.title.trim() || undefined,
          body: draft.body,
        },
      );
      setDocs((cur) => ({ ...cur, [currentKey]: document }));
      setDrafts((cur) => ({
        ...cur,
        [currentKey]: { title: document.title, body: document.body },
      }));
    } catch (err) {
      console.error('legal save failed:', err);
      setActionError('Não foi possível salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }, [current, saving, activeSurface, activeKind, draft, currentKey]);

  /* ── Publish ───────────────────────────────────────────── */
  const handlePublish = useCallback(async () => {
    if (!current || publishing) return;
    setPublishing(true);
    setActionError(null);
    setConfirmPublishOpen(false);
    try {
      const { document } = await legalService.publish(
        activeSurface,
        activeKind,
        {
          title: draft.title.trim() || undefined,
          body: draft.body,
        },
      );
      setDocs((cur) => ({ ...cur, [currentKey]: document }));
      setDrafts((cur) => ({
        ...cur,
        [currentKey]: { title: document.title, body: document.body },
      }));
    } catch (err) {
      console.error('legal publish failed:', err);
      setActionError('Não foi possível publicar. Tente de novo.');
    } finally {
      setPublishing(false);
    }
  }, [
    current,
    publishing,
    activeSurface,
    activeKind,
    draft,
    currentKey,
  ]);

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
        description="Termos de uso e política de privacidade por surface — site, app e plataforma web. Cada combinação tem fluxo de publicação independente."
      />
      <div className={styles.body}>
        {loadError && (
          <div className={styles.errorBanner}>
            <IconAlert size={14} /> {loadError}
          </div>
        )}

        {/* Surface picker — chips lilás. Trocar surface preserva
         *  drafts de outras surfaces (state por chave kind:surface). */}
        <div
          className={styles.surfaceRow}
          role="group"
          aria-label="Selecionar surface"
        >
          {LEGAL_SURFACES_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.surfaceChip} ${activeSurface === s ? styles.surfaceChipActive : ''}`}
              onClick={() => {
                setActiveSurface(s);
                setActionError(null);
              }}
              aria-pressed={activeSurface === s}
            >
              <span className={styles.surfaceChipLabel}>
                {LEGAL_SURFACE_LABELS[s]}
              </span>
              <span className={styles.surfaceChipDesc}>
                {LEGAL_SURFACE_DESCRIPTIONS[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Kind tabs — Termos / Privacidade pra surface ativa. */}
        <div className={styles.tabsRow}>
          <Tabs<LegalDocumentKind>
            items={LEGAL_KINDS_ORDER.map((k) => ({
              id: k,
              label: LEGAL_KIND_LABELS[k],
            }))}
            value={activeKind}
            onChange={(id) => {
              setActiveKind(id);
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
                  <h3 className={styles.docTitle}>
                    {LEGAL_KIND_LABELS[activeKind]} ·{' '}
                    {LEGAL_SURFACE_LABELS[activeSurface]}
                  </h3>
                  <span className={styles.docMeta}>
                    {current.publishedAt ? (
                      <>
                        Última publicação:{' '}
                        <strong>{formatDate(current.publishedAt)}</strong>
                      </>
                    ) : (
                      <>
                        Atualizado: <strong>{formatDate(current.updatedAt)}</strong>
                      </>
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
                placeholder={LEGAL_KIND_LABELS[activeKind]}
                disabled={saving || publishing}
                helperText="Aparece como título do documento publicado."
              />

              <div>
                <label
                  htmlFor={`legal-body-${activeSurface}-${activeKind}`}
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
                  id={`legal-body-${activeSurface}-${activeKind}`}
                  className={styles.editor}
                  value={draft.body}
                  onChange={(e) => setDraft({ body: e.target.value })}
                  placeholder={
                    activeKind === 'terms_of_use'
                      ? `Termos de Uso (${LEGAL_SURFACE_LABELS[activeSurface]}) — defina as regras de uso…`
                      : `Política de Privacidade (${LEGAL_SURFACE_LABELS[activeSurface]}) — explique quais dados são coletados, como são usados…`
                  }
                  disabled={saving || publishing}
                  maxLength={200_000}
                />
                <p className={styles.editorHint}>
                  Texto plano por enquanto (Markdown será renderizado em uma
                  fase seguinte). Quebras de linha são preservadas.
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
        title={`Publicar ${LEGAL_KIND_LABELS[activeKind]} de ${LEGAL_SURFACE_LABELS[activeSurface]}?`}
        description={
          current?.publishedAt
            ? `O conteúdo atual virará a versão ${current.version + 1} e aparecerá imediatamente em ${LEGAL_SURFACE_LABELS[activeSurface]}. Usuários verão a versão nova ao próximo acesso.`
            : `Isso publica a primeira versão em ${LEGAL_SURFACE_LABELS[activeSurface]}. Garanta que está revisado antes de confirmar.`
        }
        confirmLabel="Publicar agora"
        cancelLabel="Cancelar"
        loading={publishing}
      />
    </>
  );
}
