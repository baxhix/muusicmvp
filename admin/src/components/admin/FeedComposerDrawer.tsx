'use client';

import { useEffect, useMemo, useState } from 'react';
import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Switch from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import {
  IconImage,
  IconVideo,
  IconStar,
  IconFeed,
  IconCalendar,
  IconCheckCircle,
  IconEye,
} from '@/components/icons';
import { feedService } from '@/services/feed';
import type {
  FeedItem,
  FeedItemAction,
  FeedItemInput,
  FeedItemType,
  FeedMediaItem,
} from '@/types';
import FeedImageUploader from './FeedImageUploader';
import FeedScheduler from './FeedScheduler';
import styles from './FeedComposerDrawer.module.css';

/**
 * Drawer for creating + editing publications.
 *
 * State machine in one form:
 *
 *   ┌─ type      → 'image' enabled, others future-locked
 *   ├─ media     → FeedImageUploader (multi, drag-reorder)
 *   ├─ texto     → title (opcional) + description (obrigatório)
 *   └─ publicação
 *        - mode = 'draft'    → action='draft',    scheduledAt=null
 *        - mode = 'publish'  → action='publish',  scheduledAt=null
 *        - mode = 'schedule' → action='schedule', scheduledAt=<picked>
 *
 * Edit mode hydrates the form from the post being edited; clicking
 * "Atualizar" calls PATCH /api/admin/feed/:id with the patch only —
 * fields the admin didn't touch are sent unchanged (server treats
 * them as no-op). The form's submit button label flips based on
 * the active mode (Publicar / Agendar / Salvar rascunho).
 */

const TYPE_OPTIONS: Array<{
  value: FeedItemType;
  label: string;
  hint: string;
  enabled: boolean;
  icon: (size: number) => React.ReactNode;
}> = [
  { value: 'image',     label: 'Imagem',     hint: 'Uma ou várias imagens',          enabled: true,  icon: (s) => <IconImage size={s} /> },
  { value: 'video',     label: 'Vídeo',      hint: 'Em breve',                        enabled: false, icon: (s) => <IconVideo size={s} /> },
  { value: 'story',     label: 'Story',      hint: 'Em breve',                        enabled: false, icon: (s) => <IconFeed size={s} /> },
  { value: 'poll',      label: 'Enquete',    hint: 'Em breve',                        enabled: false, icon: (s) => <IconCheckCircle size={s} /> },
  { value: 'sponsored', label: 'Patrocinado', hint: 'Em breve',                        enabled: false, icon: (s) => <IconStar size={s} /> },
  { value: 'broadcast', label: 'Transmissão',hint: 'Em breve',                        enabled: false, icon: (s) => <IconEye size={s} /> },
];

type Mode = 'publish' | 'schedule' | 'draft';

interface Props {
  open: boolean;
  /** Post being edited, or null for create mode. */
  post: FeedItem | null;
  onClose: () => void;
  /** Called after a successful create/update so the listing refreshes. */
  onSaved: (post: FeedItem) => void;
}

function inferMode(post: FeedItem | null): Mode {
  if (!post) return 'publish';
  if (post.status === 'scheduled') return 'schedule';
  if (post.status === 'published') return 'publish';
  return 'draft';
}

export default function FeedComposerDrawer({ open, post, onClose, onSaved }: Props) {
  const isEdit = post !== null;
  const { push } = useToast();

  const [type, setType] = useState<FeedItemType>('image');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<FeedMediaItem[]>([]);
  const [mode, setMode] = useState<Mode>('publish');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Hydrate / reset whenever the drawer opens or the target post changes.
  useEffect(() => {
    if (!open) return;
    setType((post?.type as FeedItemType) ?? 'image');
    setTitle(post?.title ?? '');
    setDescription(post?.description ?? '');
    setMedia(post?.media ?? []);
    setMode(inferMode(post));
    setScheduledAt(post?.scheduledAt ?? null);
    setIsActive(post?.isActive ?? true);
  }, [open, post]);

  const action: FeedItemAction = mode;

  const scheduleInPast = useMemo(() => {
    if (mode !== 'schedule') return false;
    if (!scheduledAt) return true;
    return new Date(scheduledAt).getTime() <= Date.now();
  }, [mode, scheduledAt]);

  const blocking = useMemo(() => {
    if (!description.trim()) return 'description';
    if (type === 'image' && media.length === 0) return 'media';
    if (mode === 'schedule' && (!scheduledAt || scheduleInPast)) return 'schedule';
    return null;
  }, [description, type, media, mode, scheduledAt, scheduleInPast]);

  const submitLabel =
    mode === 'publish' ? (isEdit ? 'Salvar e publicar' : 'Publicar agora')
    : mode === 'schedule' ? (isEdit ? 'Salvar agendamento' : 'Agendar publicação')
    : (isEdit ? 'Salvar rascunho' : 'Salvar como rascunho');

  async function handleSubmit() {
    if (blocking || submitting) return;
    setSubmitting(true);
    const input: FeedItemInput = {
      type,
      title: title.trim() || null,
      description: description.trim(),
      media,
      scheduledAt: mode === 'schedule' ? scheduledAt : null,
      isActive,
      action,
    };
    try {
      const saved = isEdit
        ? await feedService.update(post!.id, input)
        : await feedService.create(input);
      onSaved(saved);
      push({
        type: 'success',
        title: isEdit ? 'Publicação atualizada' : 'Publicação criada',
        description:
          mode === 'publish'
            ? 'Já está visível no feed da plataforma.'
            : mode === 'schedule'
              ? `Agendada para ${new Date(saved.scheduledAt ?? scheduledAt!).toLocaleString('pt-BR')}.`
              : 'Disponível em Rascunhos para revisão posterior.',
      });
      onClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : 'save_failed';
      push({
        type: 'error',
        title: 'Não foi possível salvar',
        description: humanError(code),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Editar publicação' : 'Nova publicação'}
      description={
        isEdit
          ? 'Atualize a publicação e republique, agende ou salve como rascunho.'
          : 'Defina o tipo, anexe a mídia, escreva a descrição e escolha quando publicar.'
      }
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!!blocking}
            leadingIcon={
              mode === 'publish' ? <IconCheckCircle size={14} /> :
              mode === 'schedule' ? <IconCalendar size={14} /> :
              undefined
            }
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {/* ── Tipo ─────────────────────────────────────── */}
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Tipo</span>
          <div className={styles.typeRow}>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.typeOption} ${type === opt.value ? styles.typeOptionActive : ''}`}
                onClick={() => opt.enabled && setType(opt.value)}
                disabled={!opt.enabled}
                title={opt.enabled ? opt.label : `${opt.label} — disponível em breve`}
                aria-pressed={type === opt.value}
              >
                <span className={styles.typeIcon}>{opt.icon(14)}</span>
                <span className={styles.typeMeta}>
                  <span className={styles.typeName}>{opt.label}</span>
                  <span className={styles.typeHint}>{opt.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Mídia ────────────────────────────────────── */}
        <div className={styles.section}>
          <span className={styles.sectionTitle}>
            Mídia {type === 'image' ? '*' : ''}
          </span>
          <FeedImageUploader
            value={media}
            onChange={setMedia}
            disabled={submitting}
          />
        </div>

        {/* ── Texto ────────────────────────────────────── */}
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Texto</span>
          <Input
            inputSize="md"
            placeholder="Título (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={submitting}
          />
          <Textarea
            placeholder="Descrição da publicação"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={2200}
            required
            disabled={submitting}
            helperText={`${description.length}/2200`}
            invalid={blocking === 'description'}
          />
        </div>

        {/* ── Publicação ───────────────────────────────── */}
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Publicação</span>
          <div className={styles.modeRow}>
            <button
              type="button"
              className={`${styles.modeOption} ${mode === 'publish' ? styles.modeOptionActive : ''}`}
              onClick={() => setMode('publish')}
              aria-pressed={mode === 'publish'}
            >
              <span className={styles.modeLabel}>Publicar agora</span>
              <span className={styles.modeHint}>Vai ao ar imediatamente</span>
            </button>
            <button
              type="button"
              className={`${styles.modeOption} ${mode === 'schedule' ? styles.modeOptionActive : ''}`}
              onClick={() => setMode('schedule')}
              aria-pressed={mode === 'schedule'}
            >
              <span className={styles.modeLabel}>Agendar</span>
              <span className={styles.modeHint}>Escolher data e hora</span>
            </button>
            <button
              type="button"
              className={`${styles.modeOption} ${mode === 'draft' ? styles.modeOptionActive : ''}`}
              onClick={() => setMode('draft')}
              aria-pressed={mode === 'draft'}
            >
              <span className={styles.modeLabel}>Rascunho</span>
              <span className={styles.modeHint}>Salvar para depois</span>
            </button>
          </div>

          {mode === 'schedule' && (
            <FeedScheduler
              value={scheduledAt}
              onChange={setScheduledAt}
              disabled={submitting}
            />
          )}

          <div className={styles.activeRow}>
            <div className={styles.activeRowText}>
              <span className={styles.activeRowTitle}>Visível no feed</span>
              <span className={styles.activeRowHint}>
                Desligue para esconder do feed sem perder o histórico.
              </span>
            </div>
            <Switch
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={submitting}
              aria-label="Visibilidade no feed"
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'image_required':        return 'Adicione pelo menos uma imagem.';
    case 'description_too_long':  return 'A descrição passou de 2.200 caracteres.';
    case 'title_too_long':        return 'O título passou de 200 caracteres.';
    case 'schedule_in_past':      return 'A data de agendamento já passou.';
    case 'schedule_requires_date':return 'Informe uma data + horário para agendar.';
    case 'invalid_schedule_date': return 'Data de agendamento inválida.';
    case 'post_not_found':        return 'Publicação não encontrada.';
    default:                      return 'Tente novamente em instantes.';
  }
}
