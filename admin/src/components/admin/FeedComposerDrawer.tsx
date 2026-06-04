'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Switch from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { IconCalendar, IconCheckCircle } from '@/components/icons';
import { feedService } from '@/services/feed';
import type {
  FeedItem,
  FeedItemAction,
  FeedItemInput,
  FeedItemType,
  FeedMediaItem,
} from '@/types';
import FeedImageUploader from './FeedImageUploader';
import FeedVideoUploader from './FeedVideoUploader';
import FeedScheduler from './FeedScheduler';
import styles from './FeedComposerDrawer.module.css';

/** 24h in ms — default story window applied client-side when the
 *  admin doesn't pick a custom expiry. The server also defaults
 *  here when expiresAt is undefined; the client value just keeps
 *  the date picker pre-filled so the admin can adjust if needed. */
const DEFAULT_STORY_TTL_MS = 24 * 60 * 60 * 1000;

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

/**
 * Catalog of post types exposed in the composer.
 *
 * Icons were removed per product feedback — the label + hint
 * combination is enough at this size, and the icons cluttered the
 * 3-column grid without adding scanning value. The pill is now
 * pure typography.
 *
 * Hint strings are kept roughly the same length (~3-4 words) so
 * every option's pill renders at the same visual weight. Don't
 * stretch them past ~30 chars.
 */
const TYPE_OPTIONS: Array<{
  value: FeedItemType;
  label: string;
  hint: string;
  enabled: boolean;
}> = [
  { value: 'image',          label: 'Imagem',      hint: 'Uma ou várias imagens',   enabled: true  },
  { value: 'video',          label: 'Vídeo',       hint: 'Clipe único até 100 MB',  enabled: true  },
  { value: 'youtube_video',  label: 'YouTube',     hint: 'Link de vídeo do YouTube', enabled: true  },
  { value: 'audio',          label: 'Áudio',       hint: 'Faixa ou álbum em áudio', enabled: true  },
  { value: 'story',          label: 'Story',       hint: 'Conteúdo efêmero por 24h', enabled: true  },
  { value: 'material_alert', label: 'Materiais',   hint: 'Aviso de material novo na Central de Fãs', enabled: true  },
  { value: 'poll',           label: 'Enquete',     hint: 'Em breve',                  enabled: false },
  { value: 'sponsored',      label: 'Patrocinado', hint: 'Em breve',                  enabled: false },
  { value: 'broadcast',      label: 'Transmissão', hint: 'Em breve',                  enabled: false },
];

/** Validador leve de URL do YouTube — mesma lógica do server em
 *  `src/server/feed/admin.ts:isYoutubeUrl`. Mantida duplicada aqui
 *  pro feedback inline no composer (sem round-trip). */
function isYoutubeUrl(value: string): boolean {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'youtube-nocookie.com'
    );
  } catch {
    return false;
  }
}

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
  /** Only meaningful when type='story'. Hydrated from the post on
   *  edit; defaulted to now+24h on first selection of story type
   *  for create. */
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
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
    setExpiresAt(post?.expiresAt ?? null);
    setIsActive(post?.isActive ?? true);
  }, [open, post]);

  // Pre-fill expiresAt when the admin flips to type='story' on a
  // brand-new post that doesn't already have one. Editing an
  // existing post preserves its current value.
  useEffect(() => {
    if (type !== 'story') return;
    if (expiresAt) return;
    setExpiresAt(new Date(Date.now() + DEFAULT_STORY_TTL_MS).toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Wipe media when the admin switches between image-shape and
  // video-shape types. Stories use the image uploader (multi-slide
  // image story), videos use the single-file uploader; mixing the
  // two during one session would leave dead items in the media
  // array. Only fires when the underlying SHAPE changes, not just
  // visual category, so stories ↔ images keep their uploaded
  // pictures.
  const prevTypeRef = useRef<FeedItemType>('image');
  useEffect(() => {
    if (!open) return;
    const prev = prevTypeRef.current;
    prevTypeRef.current = type;
    if (prev === type) return;
    /* Limpa media quando troca entre "shapes" diferentes:
     *   - image/story/carousel  → multi-image uploader
     *   - video                 → upload de clipe
     *   - youtube_video         → input de URL externa
     * Trocar entre essas famílias deixa items legacy no array, então
     * reseta. Mantemos as mudanças DENTRO da mesma família (ex:
     * image ↔ story) porque o uploader é o mesmo. */
    type Shape = 'media' | 'video' | 'youtube';
    const shapeOf = (t: FeedItemType): Shape =>
      t === 'video' ? 'video' : t === 'youtube_video' ? 'youtube' : 'media';
    if (shapeOf(prev) !== shapeOf(type)) setMedia([]);
  }, [open, type]);

  const action: FeedItemAction = mode;

  const scheduleInPast = useMemo(() => {
    if (mode !== 'schedule') return false;
    if (!scheduledAt) return true;
    return new Date(scheduledAt).getTime() <= Date.now();
  }, [mode, scheduledAt]);

  const blocking = useMemo(() => {
    if (!description.trim()) return 'description';
    if (type === 'image' && media.length === 0) return 'media';
    if (type === 'video' && !media.some((m) => m.kind === 'video')) return 'media';
    if (type === 'youtube_video') {
      const yt = media.find((m) => m.kind === 'youtube');
      if (!yt || !isYoutubeUrl(yt.url)) return 'youtube';
    }
    if (type === 'story' && media.length === 0) return 'media';
    if (mode === 'schedule' && (!scheduledAt || scheduleInPast)) return 'schedule';
    if (type === 'story' && expiresAt) {
      // Reject stories whose cutoff is in the past — the post would
      // be invisible the moment it's created.
      if (new Date(expiresAt).getTime() <= Date.now()) return 'expires';
    }
    return null;
  }, [description, type, media, mode, scheduledAt, scheduleInPast, expiresAt]);

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
      // Only stories carry an expiry today. For other types we pass
      // null to explicitly clear any value left over from a
      // previous edit where the post was a story.
      expiresAt: type === 'story' ? expiresAt : null,
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
                <span className={styles.typeMeta}>
                  <span className={styles.typeName}>{opt.label}</span>
                  <span className={styles.typeHint}>{opt.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Mídia ──────────────────────────────────────
         * Tipo `material_alert` é puramente texto (title +
         * description) — o renderer no client desenha o card
         * decorativo (folder gradient + badge "Exclusivo
         * superfãs" + CTA). Sem campos de upload aqui. */}
        {type !== 'material_alert' && (
        <div className={styles.section}>
          <span className={styles.sectionTitle}>
            {type === 'youtube_video' ? 'URL do YouTube *' : (
              <>Mídia {type === 'image' || type === 'video' || type === 'story' ? '*' : ''}</>
            )}
          </span>
          {type === 'youtube_video' ? (
            (() => {
              /* Pega o primeiro item kind='youtube' (criamos se não
               * existir ao editar). Único campo: URL. O renderer
               * extrai o videoId do URL — sem precisar guardar id
               * separado. */
              const current = media.find((m) => m.kind === 'youtube');
              const value = current?.url ?? '';
              const isValid = value === '' || isYoutubeUrl(value);
              return (
                <>
                  <Input
                    inputSize="md"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={value}
                    onChange={(e) => {
                      const url = e.target.value;
                      /* Substitui o array inteiro pela row YouTube —
                       * youtube_video só usa 1 item; manter outros
                       * confundiria o backend. */
                      setMedia(url ? [{ url, kind: 'youtube' }] : []);
                    }}
                    maxLength={500}
                    disabled={submitting}
                    invalid={value !== '' && !isValid}
                    helperText={
                      value && !isValid
                        ? 'URL precisa ser do YouTube (youtube.com, youtu.be).'
                        : 'Cole o link do vídeo do YouTube. O player aparece embutido no feed.'
                    }
                  />
                </>
              );
            })()
          ) : type === 'video' ? (
            <FeedVideoUploader
              value={media}
              onChange={setMedia}
              disabled={submitting}
            />
          ) : (
            // Images + stories share the multi-slide uploader.
            // For stories each item is one "slide" of the sequence.
            <FeedImageUploader
              value={media}
              onChange={setMedia}
              disabled={submitting}
              // Stories typically have 1-10 slides; cap at 10 to
              // keep the player UX coherent.
              max={type === 'story' ? 10 : 12}
            />
          )}
        </div>
        )}

        {/* ── Expiração (apenas Story) ──────────────────── */}
        {type === 'story' && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>
              Expiração <span style={{ color: 'var(--text-mute)', fontWeight: 400 }}>(stories)</span>
            </span>
            <span className={styles.sectionHint}>
              Stories somem do feed depois desse momento. Padrão: 24h
              após a publicação.
            </span>
            <FeedScheduler
              value={expiresAt}
              onChange={setExpiresAt}
              disabled={submitting}
            />
            {blocking === 'expires' && (
              <span className={styles.fieldError}>
                A expiração precisa ser uma data futura.
              </span>
            )}
          </div>
        )}

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
    case 'video_required':        return 'Envie um vídeo para publicar.';
    case 'youtube_url_required':  return 'Cole a URL do vídeo do YouTube.';
    case 'youtube_url_invalid':   return 'A URL precisa ser do YouTube (youtube.com, youtu.be).';
    case 'story_media_required':  return 'Adicione pelo menos um slide ao story.';
    case 'description_too_long':  return 'A descrição passou de 2.200 caracteres.';
    case 'title_too_long':        return 'O título passou de 200 caracteres.';
    case 'schedule_in_past':      return 'A data de agendamento já passou.';
    case 'schedule_requires_date':return 'Informe uma data + horário para agendar.';
    case 'invalid_schedule_date': return 'Data de agendamento inválida.';
    case 'invalid_expires_date':  return 'Data de expiração inválida.';
    case 'post_not_found':        return 'Publicação não encontrada.';
    default:                      return 'Tente novamente em instantes.';
  }
}
