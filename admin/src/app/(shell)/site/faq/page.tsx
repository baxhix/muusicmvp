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
import { faqService, type FaqEntry } from '@/services/faq';
import styles from './page.module.css';

/**
 * /admin/site/faq — CRUD da seção FAQ pública.
 *
 *   - Lista todas as entradas (rascunhos + publicadas) na ordem
 *     de exibição (sortOrder asc).
 *   - "Nova pergunta" abre dialog com question, answer, category,
 *     toggle publicar. Edição abre o mesmo dialog pré-preenchido.
 *   - Setas ↑/↓ por row reordenam (POST /reorder com lista nova
 *     completa de ids).
 *   - Status badge mostra "Publicado" (verde) ou "Rascunho"
 *     (amber); a opção de toggle vive no form de edição.
 *
 * Sem drag-and-drop por enquanto — botões ↑/↓ cobrem o caso de
 * uso (lista típica vai ter <30 itens). DnD é incremento futuro
 * se a quantidade crescer.
 */
export default function FaqAdminPage() {
  const [items, setItems] = useState<FaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FaqEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FaqEntry | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  /* Reorder em background — guardamos o id do item que está sendo
   * movido pra desabilitar os botões e evitar double-fire enquanto
   * o POST /reorder roda. */
  const [reordering, setReordering] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { items: rows } = await faqService.list();
      setItems(rows);
    } catch (err) {
      console.error('FAQ load failed:', err);
      setLoadError('Não foi possível carregar as perguntas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* ── Reorder helpers ───────────────────────────────────── */
  const move = useCallback(
    async (index: number, dir: -1 | 1) => {
      if (reordering) return;
      const next = index + dir;
      if (next < 0 || next >= items.length) return;
      /* Optimistic swap local + POST com a lista nova. Se falhar,
       * recarregamos do servidor pra reverter o swap visual. */
      const newItems = items.slice();
      [newItems[index], newItems[next]] = [newItems[next], newItems[index]];
      setItems(newItems);
      setReordering(true);
      try {
        await faqService.reorder(newItems.map((i) => i.id));
      } catch (err) {
        console.error('FAQ reorder failed:', err);
        void refresh();
      } finally {
        setReordering(false);
      }
    },
    [items, reordering, refresh],
  );

  /* ── Delete ────────────────────────────────────────────── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await faqService.remove(deleteTarget.id);
      setItems((cur) => cur.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('FAQ delete failed:', err);
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTarget]);

  /* ── Save (create + update share o mesmo dialog) ────────── */
  const handleSaved = useCallback((entry: FaqEntry, isNew: boolean) => {
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
        title="FAQ"
        description="Perguntas e respostas que aparecem na seção FAQ pública do site."
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            onClick={() => setCreating(true)}
          >
            Nova pergunta
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
              title="Nenhuma pergunta cadastrada"
              description="Crie a primeira pergunta clicando em 'Nova pergunta' no canto superior direito."
            />
          ) : (
            <div className={styles.list}>
              {items.map((entry, idx) => {
                const isPublished = entry.publishedAt !== null;
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

                    <div className={styles.rowMain}>
                      <div className={styles.rowQuestion}>{entry.question}</div>
                      <div className={styles.rowMeta}>
                        <span
                          className={`${styles.statusBadge} ${
                            isPublished ? styles.statusPublished : styles.statusDraft
                          }`}
                        >
                          {isPublished ? 'Publicado' : 'Rascunho'}
                        </span>
                        {entry.category && (
                          <>
                            <span className={styles.dot}>·</span>
                            <span className={styles.rowCategory}>{entry.category}</span>
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
            {stats.total} {stats.total === 1 ? 'pergunta' : 'perguntas'} ·{' '}
            {stats.published} publicada{stats.published === 1 ? '' : 's'} ·{' '}
            {stats.drafts} rascunho{stats.drafts === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <FaqFormDialog
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
        title="Apagar pergunta?"
        description={
          deleteTarget
            ? `"${deleteTarget.question}" será removida permanentemente. Essa ação não pode ser desfeita.`
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
interface FaqFormDialogProps {
  entry: FaqEntry | null;
  onClose: () => void;
  onSaved: (entry: FaqEntry, isNew: boolean) => void;
}

function FaqFormDialog({ entry, onClose, onSaved }: FaqFormDialogProps) {
  const isNew = entry === null;
  const [question, setQuestion] = useState(entry?.question ?? '');
  const [answer, setAnswer] = useState(entry?.answer ?? '');
  const [category, setCategory] = useState(entry?.category ?? '');
  const [publish, setPublish] = useState(entry ? entry.publishedAt !== null : false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = question.trim().length > 0 && answer.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        question: question.trim(),
        answer: answer.trim(),
        category: category.trim() || null,
        publish,
      };
      const res = isNew
        ? await faqService.create(payload)
        : await faqService.update(entry!.id, payload);
      onSaved(res.entry, isNew);
    } catch (err) {
      console.error('FAQ save failed:', err);
      setError('Não foi possível salvar. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={submitting ? () => {} : onClose}
      title={isNew ? 'Nova pergunta' : 'Editar pergunta'}
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

        <Input
          label="Pergunta"
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Como faço pra…"
          disabled={submitting}
        />

        <Textarea
          label="Resposta"
          required
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={5_000}
          rows={6}
          placeholder="Resposta completa, em texto plano."
          helperText="Aparece exatamente como digitado no site público."
          disabled={submitting}
        />

        <Input
          label="Categoria (opcional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          maxLength={80}
          placeholder="Ex: Conta, Pagamentos, Privacidade"
          helperText="Útil quando o FAQ crescer e precisar de agrupamento."
          disabled={submitting}
        />

        <div className={styles.publishToggle}>
          <span>
            {publish ? 'Publicado' : 'Rascunho'}
            <em>
              {publish
                ? 'Aparece na seção FAQ pública do site.'
                : 'Fica salvo aqui mas não aparece no site público.'}
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
