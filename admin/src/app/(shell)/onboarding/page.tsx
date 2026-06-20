'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Switch from '@/components/ui/Switch';
import Dialog, { ConfirmDialog } from '@/components/ui/Dialog';
import EmptyState from '@/components/ui/EmptyState';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconAlert,
} from '@/components/icons';
import {
  onboardingTourService,
  type OnboardingCard,
} from '@/services/onboardingTour';
import styles from './page.module.css';

/**
 * /admin/onboarding — gestão completa dos cards do tour de
 * orientação in-app (deck animado mostrado ao usuário no /app).
 *
 *   - Lista todos os cards (rascunhos + publicados) na ordem de
 *     exibição (sortOrder asc).
 *   - "Novo card" abre dialog com emoji, título, corpo, CTA,
 *     decoração de globo, âncora e toggle publicar. Edição abre o
 *     mesmo dialog pré-preenchido.
 *   - Setas ↑/↓ reordenam os passos (POST /reorder).
 *   - Status badge: "Publicado" (verde) / "Rascunho" (amber).
 *
 * O app consome os cards publicados via GET /api/onboarding-tour;
 * se a lista estiver vazia, cai no deck default do cliente.
 */
export default function OnboardingAdminPage() {
  const [items, setItems] = useState<OnboardingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OnboardingCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OnboardingCard | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { items: rows } = await onboardingTourService.list();
      setItems(rows);
    } catch (err) {
      console.error('Onboarding cards load failed:', err);
      setLoadError('Não foi possível carregar os cards.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const move = useCallback(
    async (index: number, dir: -1 | 1) => {
      if (reordering) return;
      const next = index + dir;
      if (next < 0 || next >= items.length) return;
      const newItems = items.slice();
      [newItems[index], newItems[next]] = [newItems[next], newItems[index]];
      setItems(newItems);
      setReordering(true);
      try {
        await onboardingTourService.reorder(newItems.map((i) => i.id));
      } catch (err) {
        console.error('Onboarding reorder failed:', err);
        void refresh();
      } finally {
        setReordering(false);
      }
    },
    [items, reordering, refresh],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await onboardingTourService.remove(deleteTarget.id);
      setItems((cur) => cur.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Onboarding delete failed:', err);
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTarget]);

  const handleSaved = useCallback((entry: OnboardingCard, isNew: boolean) => {
    setItems((cur) => {
      if (isNew) return [...cur, entry];
      return cur.map((i) => (i.id === entry.id ? entry : i));
    });
    setEditing(null);
    setCreating(false);
  }, []);

  const stats = useMemo(() => {
    const published = items.filter((i) => i.publishedAt !== null).length;
    return {
      total: items.length,
      published,
      drafts: items.length - published,
    };
  }, [items]);

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Cards do tour de orientação que recebe os usuários dentro do app."
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            onClick={() => setCreating(true)}
          >
            Novo card
          </Button>
        }
      />
      <div className={styles.body}>
        {loadError && (
          <div className={styles.errorBanner}>
            <IconAlert size={14} /> {loadError}
          </div>
        )}

        <Card>
          {loading ? (
            <div className={styles.loading}>Carregando…</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<IconAlert />}
              title="Nenhum card cadastrado"
              description="Crie o primeiro card clicando em 'Novo card' no canto superior direito."
            />
          ) : (
            <div className={styles.list}>
              {items.map((entry, idx) => {
                const isPublished = entry.publishedAt !== null;
                /* Só a 1ª linha do título na listagem (o título
                 * suporta \n no card real). */
                const titleLine = entry.title.split('\n')[0];
                return (
                  <div key={entry.id} className={styles.row}>
                    <div className={styles.orderHandle}>
                      <button
                        type="button"
                        className={styles.orderBtn}
                        onClick={() => void move(idx, -1)}
                        disabled={idx === 0 || reordering}
                        aria-label="Mover pra cima"
                        title="Mover pra cima"
                      >
                        <IconArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.orderBtn}
                        onClick={() => void move(idx, 1)}
                        disabled={idx === items.length - 1 || reordering}
                        aria-label="Mover pra baixo"
                        title="Mover pra baixo"
                      >
                        <IconArrowDown size={14} />
                      </button>
                    </div>

                    <div className={styles.stepIndex} aria-hidden="true">
                      {entry.emoji ? (
                        <span className={styles.stepEmoji}>{entry.emoji}</span>
                      ) : (
                        <span className={styles.stepNum}>{idx + 1}</span>
                      )}
                    </div>

                    <div className={styles.rowMain}>
                      <div className={styles.rowQuestion}>{titleLine}</div>
                      <div className={styles.rowMeta}>
                        <span
                          className={`${styles.statusBadge} ${
                            isPublished ? styles.statusPublished : styles.statusDraft
                          }`}
                        >
                          {isPublished ? 'Publicado' : 'Rascunho'}
                        </span>
                        <span className={styles.dot}>·</span>
                        <span className={styles.rowCta}>{entry.cta}</span>
                        {entry.decor === 'globe' && (
                          <>
                            <span className={styles.dot}>·</span>
                            <span className={styles.decorChip}>🌐 globo</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className={styles.rowActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => setEditing(entry)}
                        aria-label="Editar"
                        title="Editar"
                      >
                        <IconEdit size={14} />
                      </Button>
                      <Button
                        variant="dangerGhost"
                        size="sm"
                        iconOnly
                        onClick={() => setDeleteTarget(entry)}
                        aria-label="Apagar"
                        title="Apagar"
                      >
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {!loading && items.length > 0 && (
          <div style={{ fontSize: 12, color: 'rgba(245,245,247,0.5)' }}>
            {stats.total} {stats.total === 1 ? 'card' : 'cards'} ·{' '}
            {stats.published} publicado{stats.published === 1 ? '' : 's'} ·{' '}
            {stats.drafts} rascunho{stats.drafts === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <OnboardingFormDialog
          entry={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Apagar card?"
        description={
          deleteTarget
            ? `"${deleteTarget.title.split('\n')[0]}" será removido permanentemente. Essa ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Apagar"
        destructive
        loading={deleteSubmitting}
      />
    </>
  );
}

/* ── Create / Edit dialog ───────────────────────────────── */
interface FormDialogProps {
  entry: OnboardingCard | null;
  onClose: () => void;
  onSaved: (entry: OnboardingCard, isNew: boolean) => void;
}

function OnboardingFormDialog({ entry, onClose, onSaved }: FormDialogProps) {
  const isNew = entry === null;
  const [emoji, setEmoji] = useState(entry?.emoji ?? '');
  const [title, setTitle] = useState(entry?.title ?? '');
  const [body, setBody] = useState(entry?.body ?? '');
  const [cta, setCta] = useState(entry?.cta ?? 'Próximo');
  const [decorGlobe, setDecorGlobe] = useState(entry?.decor === 'globe');
  const [anchor, setAnchor] = useState(entry?.anchor ?? '');
  const [publish, setPublish] = useState(entry ? entry.publishedAt !== null : true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    cta.trim().length > 0 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        emoji: emoji.trim() || null,
        title: title.trim(),
        body: body.trim(),
        cta: cta.trim(),
        decor: decorGlobe ? ('globe' as const) : null,
        anchor: anchor.trim() || null,
        publish,
      };
      const res = isNew
        ? await onboardingTourService.create(payload)
        : await onboardingTourService.update(entry!.id, payload);
      onSaved(res.entry, isNew);
    } catch (err) {
      console.error('Onboarding save failed:', err);
      setError('Não foi possível salvar. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={submitting ? () => {} : onClose}
      title={isNew ? 'Novo card' : 'Editar card'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            disabled={!canSubmit}
            loading={submitting}
          >
            {isNew ? 'Criar' : 'Salvar'}
          </Button>
        </>
      }
    >
      <form className={styles.formStack} onSubmit={handleSubmit}>
        {error && (
          <div className={styles.errorBanner}>
            <IconAlert size={14} /> {error}
          </div>
        )}

        <div className={styles.formRow}>
          <Input
            label="Emoji (opcional)"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={16}
            placeholder="🪙"
            helperText="Exibido acima do título."
            disabled={submitting}
          />
          <Input
            label="Texto do botão"
            required
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            maxLength={40}
            placeholder="Próximo"
            disabled={submitting}
          />
        </div>

        <Textarea
          label="Título"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder={'Cada ação rende\nFanpoints'}
          helperText="Use Enter pra quebrar em duas linhas."
          disabled={submitting}
        />

        <Textarea
          label="Corpo"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2_000}
          rows={4}
          placeholder="Texto de apoio do card."
          disabled={submitting}
        />

        <Input
          label="Âncora (opcional)"
          value={anchor}
          onChange={(e) => setAnchor(e.target.value)}
          maxLength={60}
          placeholder="fanpoints, chat, globe, ranking…"
          helperText="Reservado pro spotlight ancorado (sem efeito hoje)."
          disabled={submitting}
        />

        <div className={styles.publishToggle}>
          <span>
            Decoração de globo
            <em>Liga as bolhas flutuantes (use no passo do globo).</em>
          </span>
          <Switch
            checked={decorGlobe}
            onChange={(e) => setDecorGlobe(e.target.checked)}
            disabled={submitting}
            aria-label="Decoração de globo"
          />
        </div>

        <div className={styles.publishToggle}>
          <span>
            {publish ? 'Publicado' : 'Rascunho'}
            <em>
              {publish
                ? 'Aparece no tour de onboarding dos usuários.'
                : 'Fica salvo aqui mas não aparece pro usuário.'}
            </em>
          </span>
          <Switch
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            disabled={submitting}
            aria-label="Publicar"
          />
        </div>
      </form>
    </Dialog>
  );
}
