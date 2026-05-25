'use client';

import { useEffect, useMemo, useState } from 'react';
import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import {
  IconBell,
  IconCheckCircle,
  IconAlert,
  IconRefresh,
  IconMail,
  IconShield,
} from '@/components/icons';
import {
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  type NotificationItem,
  type NotificationChannel,
} from '@/services/notifications';
import { formatDateTime } from '@/lib/format';
import styles from './NotificationDetailDrawer.module.css';

/**
 * Edição completa de uma notificação. Permite:
 *  - sobrescrever label, description e trigger (campos textuais)
 *  - togglar canais (in_app, email)
 *  - togglar o master enabled (off desliga o tipo todo)
 *  - "restaurar padrão" por campo textual (volta pro catálogo)
 *
 * O draft é local até o usuário clicar "Salvar". Comparamos com
 * `item` original pra decidir se há alterações (dirty) e habilitar
 * o botão. Salvar fecha o drawer ao final.
 *
 * Notificações `system: true` (magic-link, etc) — todos os campos
 * textuais permanecem editáveis (é razoável customizar o copy), mas
 * o master toggle + canais ficam read-only com aviso.
 */
export interface NotificationDetailDrawerProps {
  item: NotificationItem | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (next: NotificationSaveDraft) => Promise<void> | void;
}

/** Shape do payload que o parent recebe. Os 3 overrides são opcionais
 *  (undefined = não toca), nullable (null = limpar pro default). */
export interface NotificationSaveDraft {
  kind: string;
  enabled: boolean;
  channels: Partial<Record<NotificationChannel, boolean>>;
  labelOverride?: string | null;
  descriptionOverride?: string | null;
  triggerOverride?: string | null;
}

interface Draft {
  enabled: boolean;
  channels: Partial<Record<NotificationChannel, boolean>>;
  label: string;
  description: string;
  trigger: string;
  /* Memoriza se o draft TÁ rodando com override pra cada campo.
   * Quando o user clica "restaurar padrão", forçamos pro valor de
   * catálogo + marcamos restored=true pra mandar null no save. */
  labelRestored: boolean;
  descriptionRestored: boolean;
  triggerRestored: boolean;
}

function buildDraft(item: NotificationItem): Draft {
  return {
    enabled: item.enabled,
    channels: { ...item.channels },
    label: item.label,
    description: item.description,
    trigger: item.trigger,
    labelRestored: false,
    descriptionRestored: false,
    triggerRestored: false,
  };
}

export default function NotificationDetailDrawer({
  item,
  open,
  saving,
  onClose,
  onSave,
}: NotificationDetailDrawerProps) {
  /* O draft é recriado toda vez que abrimos o drawer pra um item
   * diferente. Sem isto, o state local persistiria entre selects
   * — efeito colateral típico de drawers reaproveitados. */
  const [draft, setDraft] = useState<Draft | null>(
    item ? buildDraft(item) : null,
  );

  useEffect(() => {
    if (item && open) {
      setDraft(buildDraft(item));
    }
    if (!open) {
      setDraft(null);
    }
  }, [item, open]);

  const dirty = useMemo(() => {
    if (!item || !draft) return false;
    if (draft.enabled !== item.enabled) return true;
    if (
      draft.label !== item.label ||
      draft.labelRestored !== false && item.hasLabelOverride
    ) return true;
    if (
      draft.description !== item.description ||
      draft.descriptionRestored !== false && item.hasDescriptionOverride
    ) return true;
    if (
      draft.trigger !== item.trigger ||
      draft.triggerRestored !== false && item.hasTriggerOverride
    ) return true;
    // Channels: compara chave-a-chave
    const keys = new Set([
      ...Object.keys(draft.channels),
      ...Object.keys(item.channels),
    ]) as Set<NotificationChannel>;
    for (const k of keys) {
      const a = draft.channels[k] ?? item.defaultChannels.includes(k);
      const b = item.channels[k] ?? item.defaultChannels.includes(k);
      if (a !== b) return true;
    }
    return false;
  }, [item, draft]);

  if (!item || !draft) {
    return <Drawer open={open} onClose={onClose} size="lg">{null}</Drawer>;
  }

  const isSystem = item.system;
  const masterChecked = isSystem ? true : draft.enabled;

  /* Helpers de mutação do draft — só callbacks pra reduzir
   * duplicação. Cada um faz set funcional pra evitar stale state
   * em rapid-fire toggles. */
  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const toggleEnabled = () => {
    if (isSystem) return;
    setField('enabled', !draft.enabled);
  };

  const toggleChannel = (ch: NotificationChannel) => {
    if (isSystem) return;
    const current = draft.channels[ch] ?? item.defaultChannels.includes(ch);
    setDraft((d) =>
      d ? { ...d, channels: { ...d.channels, [ch]: !current } } : d,
    );
  };

  const restoreLabel = () =>
    setDraft((d) =>
      d ? { ...d, label: item.defaultLabel, labelRestored: true } : d,
    );
  const restoreDescription = () =>
    setDraft((d) =>
      d
        ? {
            ...d,
            description: item.defaultDescription,
            descriptionRestored: true,
          }
        : d,
    );
  const restoreTrigger = () =>
    setDraft((d) =>
      d ? { ...d, trigger: item.defaultTrigger, triggerRestored: true } : d,
    );

  const handleSave = async () => {
    if (!draft || !dirty) return;
    /* Payload semantics:
     *   - se restored=true → manda null (limpa override)
     *   - se valor === catálogo → não precisa salvar override (manda
     *     undefined pra preservar o atual). MAS se hasOverride era
     *     true e o valor agora == catálogo, queremos LIMPAR — então
     *     mandamos null.
     *   - se valor !== catálogo → manda a string (salva override). */
    const overrideFor = (
      draftValue: string,
      catalogValue: string,
      hadOverride: boolean,
      restored: boolean,
    ): string | null | undefined => {
      if (restored) return null;
      const trimmed = draftValue.trim();
      if (trimmed === '' || trimmed === catalogValue) {
        return hadOverride ? null : undefined;
      }
      return trimmed;
    };

    const payload: NotificationSaveDraft = {
      kind: item.kind,
      enabled: draft.enabled,
      channels: draft.channels,
      labelOverride: overrideFor(
        draft.label,
        item.defaultLabel,
        item.hasLabelOverride,
        draft.labelRestored,
      ),
      descriptionOverride: overrideFor(
        draft.description,
        item.defaultDescription,
        item.hasDescriptionOverride,
        draft.descriptionRestored,
      ),
      triggerOverride: overrideFor(
        draft.trigger,
        item.defaultTrigger,
        item.hasTriggerOverride,
        draft.triggerRestored,
      ),
    };

    await onSave(payload);
  };

  /* Indica se o campo textual está editado (atualmente diff do
   * catálogo OU tem override salvo no DB sem ter sido restaurado). */
  const labelEdited =
    !draft.labelRestored &&
    (draft.label.trim() !== item.defaultLabel || item.hasLabelOverride);
  const descriptionEdited =
    !draft.descriptionRestored &&
    (draft.description.trim() !== item.defaultDescription ||
      item.hasDescriptionOverride);
  const triggerEdited =
    !draft.triggerRestored &&
    (draft.trigger.trim() !== item.defaultTrigger ||
      item.hasTriggerOverride);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className={styles.headerInner}>
          <div className={styles.headerIcon}>
            <IconBell size={18} />
          </div>
          <div className={styles.headerText}>
            <span className={styles.headerName}>{draft.label || item.kind}</span>
            <div className={styles.headerMeta}>
              <code className={styles.kindCode}>{item.kind}</code>
              <Badge tone="neutral" size="sm">
                {CATEGORY_LABEL[item.category]}
              </Badge>
              {isSystem ? (
                <Badge tone="warning" size="sm">Sistema</Badge>
              ) : item.wired ? (
                <Badge tone="success" size="sm" dot>Ativo</Badge>
              ) : (
                <Badge tone="neutral" size="sm">Planejado</Badge>
              )}
            </div>
          </div>
        </div>
      }
      footer={
        <div className={styles.footer}>
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={!dirty || saving}
            leadingIcon={<IconCheckCircle size={14} />}
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      }
    >
      {/* ── Status master ─────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Status</span>
          <span className={styles.sectionDescription}>
            {isSystem
              ? 'Notificação de sistema — não pode ser desligada. O envio é obrigatório por motivos de segurança ou compliance.'
              : 'Desligar o master oculta esta notificação completamente — nenhum canal dispara.'}
          </span>
        </div>

        <div className={styles.statusCard} data-disabled={!masterChecked}>
          <div className={styles.statusInfo}>
            <span className={styles.statusLabel}>
              {masterChecked ? 'Ativa' : 'Desativada'}
            </span>
            <span className={styles.statusHelper}>
              {isSystem
                ? 'Notificação crítica — sempre enviada.'
                : masterChecked
                  ? 'A plataforma irá disparar esta notificação nos canais habilitados abaixo.'
                  : 'A plataforma não vai disparar este aviso em nenhum canal.'}
            </span>
          </div>
          <label
            className={styles.toggle}
            aria-label={masterChecked ? 'Desativar' : 'Ativar'}
          >
            <input
              type="checkbox"
              checked={masterChecked}
              disabled={isSystem || saving}
              onChange={toggleEnabled}
            />
            <span className={styles.toggleTrack} aria-hidden="true">
              <span className={styles.toggleThumb} />
            </span>
          </label>
        </div>
      </div>

      {/* ── Canais ────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Canais de entrega</span>
          <span className={styles.sectionDescription}>
            Escolha por quais canais este aviso vai sair. Canais marcados
            entram em cada disparo; canais desligados são pulados.
          </span>
        </div>

        <div className={styles.channelsGrid}>
          {item.supportedChannels.map((ch) => {
            const active =
              draft.channels[ch] ?? item.defaultChannels.includes(ch);
            const Icon = ch === 'email' ? IconMail : IconBell;
            return (
              <button
                key={ch}
                type="button"
                className={styles.channelCard}
                data-active={active && masterChecked}
                disabled={isSystem || saving || !masterChecked}
                onClick={() => toggleChannel(ch)}
              >
                <span className={styles.channelIcon}>
                  <Icon size={14} />
                </span>
                <span className={styles.channelText}>
                  <span className={styles.channelName}>
                    {CHANNEL_LABEL[ch]}
                  </span>
                  <span className={styles.channelHelper}>
                    {ch === 'in_app'
                      ? 'Aparece no sino dentro do app.'
                      : 'Vai pro inbox do email cadastrado.'}
                  </span>
                </span>
                <span className={styles.channelToggle} aria-hidden="true">
                  <span className={styles.channelDot} />
                </span>
              </button>
            );
          })}
        </div>

        {item.defaultChannels.length === 0 && (
          <p className={styles.warning}>
            <IconAlert size={12} /> Esta notificação não tem nenhum canal
            ligado por padrão. Marque pelo menos um pra começar a disparar.
          </p>
        )}
      </div>

      {/* ── Conteúdo (overrides editáveis) ────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Conteúdo e copy</span>
          <span className={styles.sectionDescription}>
            Personalize o texto da notificação. Deixe igual ao padrão pra
            voltar pro copy do catálogo automaticamente.
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldHead}>
            <span className={styles.fieldLabel}>Nome / título</span>
            <div className={styles.fieldHeadRight}>
              {labelEdited && (
                <Badge tone="brand" size="sm">Editado</Badge>
              )}
              {labelEdited && (
                <button
                  type="button"
                  className={styles.restoreBtn}
                  onClick={restoreLabel}
                  disabled={saving}
                >
                  <IconRefresh size={11} />
                  Restaurar padrão
                </button>
              )}
            </div>
          </div>
          <Input
            value={draft.label}
            onChange={(e) => {
              setField('label', e.target.value);
              setField('labelRestored', false);
            }}
            placeholder={item.defaultLabel}
            disabled={saving}
            maxLength={200}
          />
          <span className={styles.fieldHint}>
            Padrão do catálogo: <span>“{item.defaultLabel}”</span>
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldHead}>
            <span className={styles.fieldLabel}>Descrição</span>
            <div className={styles.fieldHeadRight}>
              {descriptionEdited && (
                <Badge tone="brand" size="sm">Editado</Badge>
              )}
              {descriptionEdited && (
                <button
                  type="button"
                  className={styles.restoreBtn}
                  onClick={restoreDescription}
                  disabled={saving}
                >
                  <IconRefresh size={11} />
                  Restaurar padrão
                </button>
              )}
            </div>
          </div>
          <Textarea
            value={draft.description}
            onChange={(e) => {
              setField('description', e.target.value);
              setField('descriptionRestored', false);
            }}
            placeholder={item.defaultDescription}
            disabled={saving}
            maxLength={2000}
            rows={3}
          />
          <span className={styles.fieldHint}>
            Padrão do catálogo: <span>“{item.defaultDescription}”</span>
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldHead}>
            <span className={styles.fieldLabel}>Quando dispara</span>
            <div className={styles.fieldHeadRight}>
              {triggerEdited && (
                <Badge tone="brand" size="sm">Editado</Badge>
              )}
              {triggerEdited && (
                <button
                  type="button"
                  className={styles.restoreBtn}
                  onClick={restoreTrigger}
                  disabled={saving}
                >
                  <IconRefresh size={11} />
                  Restaurar padrão
                </button>
              )}
            </div>
          </div>
          <Textarea
            value={draft.trigger}
            onChange={(e) => {
              setField('trigger', e.target.value);
              setField('triggerRestored', false);
            }}
            placeholder={item.defaultTrigger}
            disabled={saving}
            maxLength={2000}
            rows={2}
          />
          <span className={styles.fieldHint}>
            Padrão do catálogo: <span>“{item.defaultTrigger}”</span>
          </span>
        </div>
      </div>

      {/* ── Meta info (read-only) ─────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Atributos do catálogo</span>
          <span className={styles.sectionDescription}>
            Definidos em código. Não editáveis no admin — alteração
            estrutural exige deploy.
          </span>
        </div>

        <div className={styles.metaGrid}>
          <div className={styles.metaCell}>
            <span className={styles.metaLabel}>Categoria</span>
            <span className={styles.metaValue}>
              {CATEGORY_LABEL[item.category]}
            </span>
          </div>
          <div className={styles.metaCell}>
            <span className={styles.metaLabel}>Canais suportados</span>
            <span className={styles.metaValue}>
              {item.supportedChannels.map((c) => CHANNEL_LABEL[c]).join(' · ')}
            </span>
          </div>
          <div className={styles.metaCell}>
            <span className={styles.metaLabel}>Estado de implementação</span>
            <span className={styles.metaValue}>
              {item.wired ? (
                <span className={styles.metaInline}>
                  <IconCheckCircle size={12} /> Conectado em código
                </span>
              ) : (
                <span className={styles.metaInline}>
                  <IconAlert size={12} /> Planejado (ainda não dispara)
                </span>
              )}
            </span>
          </div>
          <div className={styles.metaCell}>
            <span className={styles.metaLabel}>Tipo</span>
            <span className={styles.metaValue}>
              {isSystem ? (
                <span className={styles.metaInline}>
                  <IconShield size={12} /> Sistema (sempre ativo)
                </span>
              ) : (
                <span className={styles.metaInline}>Configurável</span>
              )}
            </span>
          </div>
          <div className={styles.metaCell}>
            <span className={styles.metaLabel}>Última atualização</span>
            <span className={styles.metaValue}>
              {item.updatedAt
                ? formatDateTime(item.updatedAt)
                : 'Nunca editada — usando padrão'}
            </span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
