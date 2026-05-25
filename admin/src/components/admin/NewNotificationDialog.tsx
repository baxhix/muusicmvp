'use client';

import { useEffect, useMemo, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { IconCheckCircle, IconBell, IconMail } from '@/components/icons';
import { cn } from '@/lib/utils';
import {
  buildCustomDraft,
  saveCustomDraft,
  loadCustomDrafts,
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  type NotificationItem,
  type NotificationCategory,
  type NotificationChannel,
} from '@/services/notifications';
import styles from './NewNotificationDialog.module.css';

interface NewNotificationDialogProps {
  open: boolean;
  onClose: () => void;
  /** Lista atual de kinds (catálogo + drafts) — pra impedir duplicado. */
  existingKinds: string[];
  onCreated: (draft: NotificationItem) => void;
}

const CATEGORY_OPTIONS: { value: NotificationCategory; label: string }[] = [
  { value: 'lifecycle',  label: CATEGORY_LABEL.lifecycle },
  { value: 'social',     label: CATEGORY_LABEL.social },
  { value: 'content',    label: CATEGORY_LABEL.content },
  { value: 'engagement', label: CATEGORY_LABEL.engagement },
];

const KIND_REGEX = /^[a-z0-9_]+$/;

/**
 * Dialog de criação de notificação personalizada (mock).
 *
 * Persistência via localStorage — o servidor só conhece o catálogo
 * hardcoded em KNOWN_NOTIFICATIONS. O draft é puramente client-side,
 * marcado com `wired=false` + `system=false`, aparece na listagem
 * com badge "Personalizada" e é editável pelo mesmo editor full-page.
 *
 * Campos:
 *   - kind: slug único (lowercase + underscores), obrigatório
 *   - label: nome visível
 *   - description: texto principal
 *   - trigger: descrição do gatilho
 *   - category: 1 das 4 do catálogo
 *   - canais suportados (multi): pelo menos 1
 *   - canais default (multi): subconjunto dos suportados
 *
 * Validação rasa — esse fluxo é demo. Em produção, com BE, faria
 * mais validações (unicidade no DB, tamanho, etc).
 */
export default function NewNotificationDialog({
  open,
  onClose,
  existingKinds,
  onCreated,
}: NewNotificationDialogProps) {
  const { push } = useToast();

  const [kind, setKind] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('engagement');
  const [supported, setSupported] = useState<Set<NotificationChannel>>(
    new Set(['in_app']),
  );
  const [defaults, setDefaults] = useState<Set<NotificationChannel>>(
    new Set(['in_app']),
  );

  /* Reseta o form sempre que abre — evita state "azedo" de uma
   * abertura anterior cancelada. */
  useEffect(() => {
    if (open) {
      setKind('');
      setLabel('');
      setDescription('');
      setTrigger('');
      setCategory('engagement');
      setSupported(new Set(['in_app']));
      setDefaults(new Set(['in_app']));
    }
  }, [open]);

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
  const channelError =
    supported.size === 0 ? 'Selecione pelo menos um canal.' : null;

  const canSubmit = !kindError && !labelError && !channelError;

  function toggleSupported(ch: NotificationChannel) {
    setSupported((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) {
        next.delete(ch);
        /* Se desligou um canal supported, garante que ele também
         * sai dos defaults — defaults é subconjunto. */
        setDefaults((d) => {
          const dn = new Set(d);
          dn.delete(ch);
          return dn;
        });
      } else {
        next.add(ch);
      }
      return next;
    });
  }

  function toggleDefault(ch: NotificationChannel) {
    if (!supported.has(ch)) return;
    setDefaults((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

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
    const draft = buildCustomDraft({
      kind: trimmedKind,
      label: label.trim(),
      description: description.trim() || 'Sem descrição.',
      trigger: trigger.trim() || 'Gatilho a definir.',
      category,
      supportedChannels: Array.from(supported),
      defaultChannels: Array.from(defaults),
    });
    saveCustomDraft(draft);
    push({
      type: 'success',
      title: 'Notificação criada',
      description: `"${draft.label}" está disponível na listagem.`,
    });
    onCreated(draft);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Nova notificação"
      description="Crie uma notificação personalizada. Aparece na listagem com badge “Personalizada” e fica editável no mesmo editor das demais."
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
            Criar notificação
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.row}>
          <Input
            label="Identificador (kind)"
            required
            value={kind}
            onChange={(e) =>
              setKind(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
            placeholder="ex: boas_vindas_premium"
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
            placeholder="ex: Boas-vindas Premium"
            errorText={labelError && label.length > 0 ? labelError : undefined}
            maxLength={200}
          />
        </div>

        <Textarea
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que essa notificação comunica pro usuário?"
          rows={2}
          maxLength={2000}
        />

        <Textarea
          label="Quando dispara"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="Ex: Quando o usuário ativa o plano premium pela primeira vez."
          rows={2}
          maxLength={2000}
        />

        <div className={styles.row}>
          <Select
            label="Categoria"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as NotificationCategory)
            }
            options={CATEGORY_OPTIONS}
            required
          />

          <div className={styles.channelGroup}>
            <span className={styles.channelGroupLabel}>
              Canais suportados <span className={styles.required}>*</span>
            </span>
            <div className={styles.channelChips}>
              {(['in_app', 'email'] as NotificationChannel[]).map((ch) => {
                const Icon = ch === 'email' ? IconMail : IconBell;
                const active = supported.has(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    className={cn(
                      styles.channelChip,
                      active && styles.channelChipActive,
                    )}
                    onClick={() => toggleSupported(ch)}
                  >
                    <Icon size={12} />
                    {CHANNEL_LABEL[ch]}
                  </button>
                );
              })}
            </div>
            {channelError && (
              <span className={styles.channelError}>{channelError}</span>
            )}
          </div>
        </div>

        <div className={styles.defaultsRow}>
          <span className={styles.channelGroupLabel}>
            Canais ativos por padrão
          </span>
          <span className={styles.defaultsHint}>
            Subconjunto dos suportados — define o estado inicial quando
            ninguém ainda configurou.
          </span>
          <div className={styles.channelChips}>
            {(['in_app', 'email'] as NotificationChannel[]).map((ch) => {
              const Icon = ch === 'email' ? IconMail : IconBell;
              const isSupported = supported.has(ch);
              const active = defaults.has(ch);
              return (
                <button
                  key={ch}
                  type="button"
                  className={cn(
                    styles.channelChip,
                    active && styles.channelChipActive,
                    !isSupported && styles.channelChipMuted,
                  )}
                  onClick={() => toggleDefault(ch)}
                  disabled={!isSupported}
                  title={
                    !isSupported
                      ? 'Habilite primeiro como canal suportado'
                      : undefined
                  }
                >
                  <Icon size={12} />
                  {CHANNEL_LABEL[ch]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
