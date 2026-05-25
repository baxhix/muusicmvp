'use client';

import { useEffect, useMemo, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { IconCheckCircle, IconAlert } from '@/components/icons';
import {
  buildCustomDraft,
  saveCustomDraft,
  loadCustomDrafts,
  CATEGORY_LABEL,
  type NotificationItem,
  type NotificationCategory,
} from '@/services/notifications';
import styles from './NewNotificationDialog.module.css';

/** Canal do contexto onde a criação foi iniciada — vem da tab
 *  ativa em /admin/notificacoes. Determina o tom + os defaults
 *  do dialog. NÃO existe canal `push` no enum NotificationChannel
 *  do servidor; tratamos como placeholder até o canal subir. */
export type CreationChannel = 'platform' | 'push';

interface NewNotificationDialogProps {
  open: boolean;
  onClose: () => void;
  /** Lista atual de kinds (catálogo + drafts) — pra impedir duplicado. */
  existingKinds: string[];
  onCreated: (draft: NotificationItem) => void;
  /** Tab de canal onde o user clicou "Nova notificação". Determina
   *  título, descrição, defaults e campos extras visíveis. */
  channel: CreationChannel;
}

const CATEGORY_OPTIONS: { value: NotificationCategory; label: string }[] = [
  { value: 'lifecycle',  label: CATEGORY_LABEL.lifecycle },
  { value: 'social',     label: CATEGORY_LABEL.social },
  { value: 'content',    label: CATEGORY_LABEL.content },
  { value: 'engagement', label: CATEGORY_LABEL.engagement },
];

const KIND_REGEX = /^[a-z0-9_]+$/;

/* Cópia varia por canal — título, descrição do dialog, helper
 * texts e placeholders dos campos refletem o contexto. "Nem
 * sempre são iguais e enviadas no mesmo tempo" — separação total
 * dos fluxos. */
const COPY: Record<
  CreationChannel,
  {
    title: string;
    description: string;
    submitLabel: string;
    triggerLabel: string;
    triggerPlaceholder: string;
    descPlaceholder: string;
    labelPlaceholder: string;
    kindPlaceholder: string;
    /** Banner de aviso opcional acima do form (e.g. push em dev). */
    banner: string | null;
  }
> = {
  platform: {
    title: 'Nova notificação na plataforma',
    description:
      'Aparece dentro do app (sino, feed). Disparada conforme o ' +
      'gatilho — em tempo real ou agendada por cron.',
    submitLabel: 'Criar na plataforma',
    triggerLabel: 'Quando dispara',
    triggerPlaceholder:
      'Ex: Quando o usuário recebe uma resposta em um post seu.',
    descPlaceholder:
      'O que o usuário vê no sino. Curto, contextual, com nome do autor.',
    labelPlaceholder: 'ex: Resposta no seu post',
    kindPlaceholder: 'ex: post_reply',
    banner: null,
  },
  push: {
    title: 'Nova push notification (App)',
    description:
      'Notificação enviada ao app instalado no celular do usuário. ' +
      'Independente da plataforma — pode ser agendada pra outro horário, ' +
      'pra outro segmento e com outro copy.',
    submitLabel: 'Criar push',
    triggerLabel: 'Quando dispara (agenda ou evento)',
    triggerPlaceholder:
      'Ex: Diariamente às 9h pros usuários que não abriram o app em 3+ dias.',
    descPlaceholder:
      'Texto curto e direto — push tem limite de caracteres e o usuário ' +
      'lê na lockscreen.',
    labelPlaceholder: 'ex: Volta pra ver o que rolou',
    kindPlaceholder: 'ex: push_winback_3d',
    banner:
      'Push notifications estão em desenvolvimento — o canal ainda não ' +
      'dispara automaticamente. O draft fica salvo como planejado e entra ' +
      'no ar quando a integração subir.',
  },
};

/**
 * Dialog de criação de notificação personalizada (mock).
 *
 * Persistência via localStorage — o servidor só conhece o catálogo
 * hardcoded em KNOWN_NOTIFICATIONS. O draft é puramente client-side,
 * marcado com `wired=false` + `system=false`, aparece na listagem
 * com badge "Personalizada" e é editável pelo mesmo editor full-page.
 *
 * Canal-aware: o `channel` prop vem da tab ativa em
 * /admin/notificacoes (Plataforma vs App Push). Determina título,
 * defaults e copy do form — Plataforma vai pro canal `in_app`, Push
 * vai pra um placeholder até o canal `push` ser adicionado ao enum.
 */
export default function NewNotificationDialog({
  open,
  onClose,
  existingKinds,
  onCreated,
  channel,
}: NewNotificationDialogProps) {
  const { push } = useToast();
  const copy = COPY[channel];

  const [kind, setKind] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('engagement');

  /* Reseta o form sempre que abre — evita state "azedo" de uma
   * abertura anterior cancelada. */
  useEffect(() => {
    if (open) {
      setKind('');
      setLabel('');
      setDescription('');
      setTrigger('');
      setCategory('engagement');
    }
  }, [open, channel]);

  const trimmedKind = kind.trim().toLowerCase();
  const kindError = useMemo(() => {
    if (!trimmedKind) return 'Identificador obrigatório.';
    if (trimmedKind.length > 60) return 'Máximo 60 caracteres.';
    if (!KIND_REGEX.test(trimmedKind))
      return 'Use só letras minúsculas, números e _.';
    if (existingKinds.includes(trimmedKind))
      return 'Já existe uma notificação com esse identificador.';
    return null;
  }, [trimmedKind, existingKinds]);

  const labelError = !label.trim() ? 'Obrigatório.' : null;

  const canSubmit = !kindError && !labelError;

  function submit() {
    if (!canSubmit) return;
    /* Defesa anti-race: re-checa contra localStorage no momento de
     * salvar (alguém pode ter criado um draft com mesmo kind em
     * outra aba). */
    const conflict = loadCustomDrafts().some((d) => d.kind === trimmedKind);
    if (conflict) {
      push({
        type: 'error',
        title: 'Identificador já em uso',
        description: 'Escolha um nome diferente — esse já foi cadastrado.',
      });
      return;
    }
    /* Canal-determinado: Plataforma → ['in_app']; Push → ['in_app']
     * (placeholder até o enum suportar 'push'). Defaults seguem o
     * mesmo conjunto pra manter o draft consistente. Quando o canal
     * push existir, basta trocar 'in_app' por 'push' no branch. */
    const supportedChannels =
      channel === 'platform'
        ? (['in_app'] as const)
        : (['in_app'] as const); // TODO: ['push'] quando o enum subir
    const draft = buildCustomDraft({
      kind: trimmedKind,
      label: label.trim(),
      description: description.trim() || 'Sem descrição.',
      trigger: trigger.trim() || 'Gatilho a definir.',
      category,
      supportedChannels: [...supportedChannels],
      defaultChannels: [...supportedChannels],
    });
    saveCustomDraft(draft);
    push({
      type: 'success',
      title:
        channel === 'platform'
          ? 'Notificação criada na plataforma'
          : 'Push criada (planejada)',
      description: `"${draft.label}" está disponível na listagem.`,
    });
    onCreated(draft);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={copy.title}
      description={copy.description}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconCheckCircle size={14} />}
            onClick={submit}
            disabled={!canSubmit}
          >
            {copy.submitLabel}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {/* Banner contextual — só aparece pra push, sinalizando que o
         * canal ainda não dispara automaticamente. Visualmente parecido
         * com os toasts "warning" pra reforçar que é estado planejado. */}
        {copy.banner && (
          <div className={styles.banner} role="status">
            <IconAlert size={14} />
            <span>{copy.banner}</span>
          </div>
        )}

        <div className={styles.row}>
          <Input
            label="Identificador (kind)"
            required
            value={kind}
            onChange={(e) =>
              setKind(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
            placeholder={copy.kindPlaceholder}
            helperText={
              kindError ?? 'Usado em código + nos logs. Não muda depois.'
            }
            errorText={kindError && kind ? kindError : undefined}
            maxLength={60}
          />
          <Input
            label="Nome / título"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={copy.labelPlaceholder}
            errorText={labelError && label.length > 0 ? labelError : undefined}
            maxLength={200}
          />
        </div>

        <Textarea
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={copy.descPlaceholder}
          rows={2}
          maxLength={2000}
        />

        <Textarea
          label={copy.triggerLabel}
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder={copy.triggerPlaceholder}
          rows={2}
          maxLength={2000}
        />

        <Select
          label="Categoria"
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as NotificationCategory)
          }
          options={CATEGORY_OPTIONS}
          required
        />
      </div>
    </Dialog>
  );
}
