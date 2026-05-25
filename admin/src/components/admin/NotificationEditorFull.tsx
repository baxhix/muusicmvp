'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Badge from '@/components/ui/Badge';
import Tabs from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import {
  IconCheckCircle,
  IconRefresh,
  IconBell,
  IconMail,
  IconShield,
  IconEdit,
  IconAlert,
  IconHome,
  IconChevronRight,
  IconTrash,
  IconSend,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import NotificationPreview, { type PreviewDevice } from './NotificationPreview';
import { ConfirmDialog } from '@/components/ui/Dialog';
import {
  notificationsService,
  saveCustomDraft,
  deleteCustomDraft,
  buildCustomDraft,
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  TRIGGERABLE_KINDS,
  type NotificationItem,
  type NotificationChannel,
  type CronTriggerResponse,
} from '@/services/notifications';
import { formatDateTime } from '@/lib/format';
import styles from './NotificationEditorFull.module.css';

interface NotificationEditorFullProps {
  item: NotificationItem;
  /** Quando true, o item veio dos drafts em localStorage. O save
   *  vai pro localStorage (não pra API). Também habilita o botão
   *  de excluir. Esconde os "Restaurar padrão" porque não existe
   *  conceito de catálogo pra drafts personalizados. */
  isCustomDraft?: boolean;
}

type ViewMode = 'editor' | 'preview';

/**
 * Editor full-page de uma notificação.
 *
 * Layout (espelha o `TemplateEditorFull` dos templates de email):
 *   - Topbar 2 linhas: breadcrumb + actions, título editável + badges
 *   - Body desktop: sidebar (controles) + canvas (preview)
 *   - Body mobile: tabs alternando Editar / Preview
 *
 * Preview mostra mockups da notificação no app (sino + card) e no
 * email (inbox + corpo) lado-a-lado pra admin ver imediatamente o
 * impacto das mudanças de copy.
 *
 * Diferença pro drawer antigo: aqui tem MUITO mais espaço pra
 * descrição, trigger e meta info — além das simulações visuais.
 * Drawer cabia 6 campos espremidos; aqui cada seção respira.
 */
export default function NotificationEditorFull({
  item,
  isCustomDraft = false,
}: NotificationEditorFullProps) {
  const router = useRouter();
  const { push } = useToast();

  /* Snapshot inicial — preservado pra comparar "dirty" + permitir
   * "restaurar padrão" por campo (volta ao default do catálogo). */
  const original = useRef(item).current;

  const [label, setLabel] = useState(item.label);
  const [description, setDescription] = useState(item.description);
  const [trigger, setTrigger] = useState(item.trigger);
  const [enabled, setEnabled] = useState(item.enabled);
  const [channels, setChannels] = useState<
    Partial<Record<NotificationChannel, boolean>>
  >({ ...item.channels });

  /* Restored flags — quando true, ao salvar mandamos `null` no
   * override (limpa pro default). Reset quando o user edita o campo
   * de novo (porque vira override de novo). */
  const [labelRestored, setLabelRestored] = useState(false);
  const [descriptionRestored, setDescriptionRestored] = useState(false);
  const [triggerRestored, setTriggerRestored] = useState(false);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  /* Trigger ("Enviar teste agora") — só renderiza pros kinds
   * cron-disparáveis (TRIGGERABLE_KINDS) e wired. Mantém o último
   * resultado pra exibir feedback inline (não é só toast). */
  const isTriggerable =
    !isCustomDraft && item.wired && TRIGGERABLE_KINDS.has(item.kind);
  const [triggering, setTriggering] = useState(false);
  const [lastTrigger, setLastTrigger] = useState<CronTriggerResponse | null>(
    null,
  );
  const [lastTriggerError, setLastTriggerError] = useState<string | null>(null);

  /* Mobile alterna entre editor/preview via tabs. */
  const [view, setView] = useState<ViewMode>('editor');

  /* Preview canvas tem seu próprio toggle de device — iPhone /
   * Android (ambos do canal in_app) e Email. Só mostra cada aba
   * quando o canal correspondente é supported. Default: iPhone se
   * in_app suportado, senão email. */
  const initialPreviewDevice: PreviewDevice = item.supportedChannels.includes(
    'in_app',
  )
    ? 'iphone'
    : 'email';
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>(
    initialPreviewDevice,
  );

  /* Quando o device é iphone/android, queremos checar `in_app`
   * pra o `channelEnabled`; email checa `email`. */
  const previewChannelKey: NotificationChannel =
    previewDevice === 'email' ? 'email' : 'in_app';

  const isSystem = item.system;
  const masterChecked = isSystem ? true : enabled;

  /* Edited flags — comparam o valor atual vs catálogo (`defaultX`).
   * São TRUE se há override (sea seja por DB anterior ou edit atual).
   * Vira FALSE se o user clicou "restaurar padrão" ou se o draft
   * agora bate exatamente com o default. */
  const labelEdited =
    !labelRestored &&
    (label.trim() !== item.defaultLabel || item.hasLabelOverride);
  const descriptionEdited =
    !descriptionRestored &&
    (description.trim() !== item.defaultDescription ||
      item.hasDescriptionOverride);
  const triggerEdited =
    !triggerRestored &&
    (trigger.trim() !== item.defaultTrigger || item.hasTriggerOverride);

  const dirty = useMemo(() => {
    if (enabled !== original.enabled) return true;
    if (label !== original.label) return true;
    if (description !== original.description) return true;
    if (trigger !== original.trigger) return true;
    if (labelRestored && original.hasLabelOverride) return true;
    if (descriptionRestored && original.hasDescriptionOverride) return true;
    if (triggerRestored && original.hasTriggerOverride) return true;
    const keys = new Set([
      ...Object.keys(channels),
      ...Object.keys(original.channels),
    ]) as Set<NotificationChannel>;
    for (const k of keys) {
      const a = channels[k] ?? original.defaultChannels.includes(k);
      const b = original.channels[k] ?? original.defaultChannels.includes(k);
      if (a !== b) return true;
    }
    return false;
  }, [
    enabled,
    label,
    description,
    trigger,
    labelRestored,
    descriptionRestored,
    triggerRestored,
    channels,
    original,
  ]);

  function toggleChannel(ch: NotificationChannel) {
    if (isSystem) return;
    const current = channels[ch] ?? item.defaultChannels.includes(ch);
    setChannels((prev) => ({ ...prev, [ch]: !current }));
  }

  function restoreLabel() {
    setLabel(item.defaultLabel);
    setLabelRestored(true);
  }
  function restoreDescription() {
    setDescription(item.defaultDescription);
    setDescriptionRestored(true);
  }
  function restoreTrigger() {
    setTrigger(item.defaultTrigger);
    setTriggerRestored(true);
  }

  /* Override payload semantics (mesma do drawer antigo):
   *   - restored=true       → null (limpa override no DB)
   *   - bate com catalog    → undefined (mantém estado) ou null
   *     (limpar se tinha override). Vamos pelo "limpar" pra deixar
   *     o estado consistente.
   *   - diferente do catalog → string (salva override). */
  function overrideFor(
    current: string,
    catalog: string,
    hadOverride: boolean,
    restored: boolean,
  ): string | null | undefined {
    if (restored) return null;
    const trimmed = current.trim();
    if (trimmed === '' || trimmed === catalog) {
      return hadOverride ? null : undefined;
    }
    return trimmed;
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      if (isCustomDraft) {
        /* Drafts personalizados → localStorage. Reconstruímos o
         * NotificationItem com os campos atuais — `defaultX` espelha
         * o que está no draft (não há "catálogo" pra um custom). */
        const updatedDraft = buildCustomDraft({
          kind: item.kind,
          label: label.trim(),
          description: description.trim() || item.description,
          trigger: trigger.trim() || item.trigger,
          category: item.category,
          supportedChannels: item.supportedChannels,
          defaultChannels: item.defaultChannels,
        });
        /* Preserva enabled + channels do estado atual (o build cria
         * com defaults). */
        updatedDraft.enabled = enabled;
        updatedDraft.channels = channels;
        saveCustomDraft(updatedDraft);
      } else {
        await notificationsService.upsert({
          kind: item.kind,
          enabled,
          channels,
          labelOverride: overrideFor(
            label,
            item.defaultLabel,
            item.hasLabelOverride,
            labelRestored,
          ),
          descriptionOverride: overrideFor(
            description,
            item.defaultDescription,
            item.hasDescriptionOverride,
            descriptionRestored,
          ),
          triggerOverride: overrideFor(
            trigger,
            item.defaultTrigger,
            item.hasTriggerOverride,
            triggerRestored,
          ),
        });
      }
      push({
        type: 'success',
        title: 'Notificação salva',
        description: `“${label}” foi atualizada.`,
      });
      router.push('/notificacoes');
    } catch (err) {
      push({
        type: 'error',
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  }

  /* Dispara o cron em "modo teste" — chama o handler real,
   * mesmas queries + mesmo envio de email. Não há dry-run no BE
   * (cron já é idempotente o suficiente pra rodar 2x sem efeitos
   * laterais inesperados na maioria dos casos). UI deixa isso
   * claro com texto "Vai enviar email de verdade". */
  async function handleTrigger() {
    if (!isTriggerable || triggering) return;
    setTriggering(true);
    setLastTrigger(null);
    setLastTriggerError(null);
    try {
      const res = await notificationsService.trigger(item.kind);
      setLastTrigger(res);
      push({
        type: 'success',
        title: 'Disparo concluído',
        description: summarizeTriggerResult(item.kind, res),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha desconhecida.';
      setLastTriggerError(msg);
      push({
        type: 'error',
        title: 'Não foi possível disparar',
        description: msg,
      });
    } finally {
      setTriggering(false);
    }
  }

  /* Excluir só faz sentido pra drafts personalizados — itens do
   * catálogo não podem ser apagados (são definidos em código). */
  function handleDelete() {
    if (!isCustomDraft) return;
    deleteCustomDraft(item.kind);
    push({
      type: 'success',
      title: 'Notificação removida',
      description: `“${item.label}” foi excluída do catálogo personalizado.`,
    });
    router.push('/notificacoes');
  }

  return (
    <div className={styles.root}>
      {/* ── Topbar ──────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.topbarRow1}>
          {/* Breadcrumb estilo Materiais — botões com ícone home no
           * root + chevron como separador + estado `crumbActive` no
           * último (não clicável). */}
          <nav className={styles.breadcrumb} aria-label="Caminho">
            <button
              type="button"
              className={styles.crumb}
              onClick={() => router.push('/notificacoes')}
            >
              <IconHome size={13} />
              <span>Notificações</span>
            </button>
            <span className={styles.crumbGroup}>
              <IconChevronRight size={12} className={styles.crumbSep} />
              <button
                type="button"
                className={cn(styles.crumb, styles.crumbActive)}
                disabled
                aria-current="page"
              >
                {label || item.kind}
              </button>
            </span>
          </nav>

          {/* Topbar limpo: status do edit state apenas (Personalizada
           * / Editado). Os atributos do catálogo (kind, categoria,
           * sistema) + master toggle vivem agora dentro do formulário
           * — junto com os campos que afetam. Botões Cancelar/Salvar
           * descem pro footer do form. */}
          <div className={styles.topbarStatus}>
            {isCustomDraft && (
              <Badge tone="info" size="sm" dot>Personalizada</Badge>
            )}
            {!isCustomDraft &&
              (labelEdited || descriptionEdited || triggerEdited) && (
                <Badge tone="brand" size="sm">Editado</Badge>
              )}
          </div>
        </div>

        <div className={styles.topbarRow2}>
          <div className={styles.titleWrap}>
            <input
              ref={labelInputRef}
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setLabelRestored(false);
              }}
              placeholder={item.defaultLabel}
              className={styles.titleInput}
              aria-label="Nome da notificação"
              spellCheck={false}
              maxLength={200}
              disabled={saving}
            />
            <button
              type="button"
              className={styles.titleEditIcon}
              onClick={() => labelInputRef.current?.focus()}
              aria-label="Editar nome"
              title="Clique pra editar"
              tabIndex={-1}
            >
              <IconEdit size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile tabs ─────────────────────────────────── */}
      <div className={styles.mobileTabs}>
        <Tabs<ViewMode>
          items={[
            { id: 'editor',  label: 'Editar' },
            { id: 'preview', label: 'Pré-visualizar' },
          ]}
          value={view}
          onChange={setView}
          variant="pills"
        />
      </div>

      {/* ── Body: sidebar (form) + canvas (preview) ─────── */}
      <div className={styles.body}>
        <aside
          className={`${styles.sidebar} ${
            view === 'editor' ? styles.activeMobile : styles.hiddenMobile
          }`}
        >
          <div className={styles.sidebarInner}>
            {/* ── Status ─────────────────────────────────── */}
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>Status</span>
                <span className={styles.sectionDesc}>
                  {isSystem
                    ? 'Notificação de sistema — crítica, não pode ser desligada.'
                    : 'Liga/desliga o tipo inteiro. Desativado, nenhum canal dispara.'}
                </span>
              </div>
              <div className={styles.statusCard} data-disabled={!masterChecked}>
                <div className={styles.statusInfo}>
                  <span className={styles.statusLabel}>
                    {masterChecked ? 'Ativa' : 'Desativada'}
                  </span>
                  <span className={styles.statusHelper}>
                    {isSystem
                      ? 'Crítica — sempre enviada.'
                      : masterChecked
                        ? 'A plataforma irá disparar nos canais habilitados abaixo.'
                        : 'Nenhum canal dispara enquanto estiver desativada.'}
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
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  <span className={styles.toggleTrack} aria-hidden="true">
                    <span className={styles.toggleThumb} />
                  </span>
                </label>
              </div>
            </section>

            {/* ── Canais ─────────────────────────────────── */}
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>Canais de entrega</span>
                <span className={styles.sectionDesc}>
                  Escolha por quais canais este aviso vai sair. Canais marcados
                  entram em cada disparo; desligados são pulados.
                </span>
              </div>
              <div className={styles.channelsGrid}>
                {item.supportedChannels.map((ch) => {
                  const active =
                    channels[ch] ?? item.defaultChannels.includes(ch);
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
            </section>

            {/* ── Copy editável ──────────────────────────── */}
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>Conteúdo e copy</span>
                <span className={styles.sectionDesc}>
                  {isCustomDraft
                    ? 'Edite o copy livremente. Drafts personalizados não têm "padrão de catálogo" — qualquer valor vira o novo padrão pra esta notificação.'
                    : 'Personalize o texto. Deixe igual ao padrão pra voltar ao copy do catálogo.'}
                </span>
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>Descrição</span>
                  {!isCustomDraft && descriptionEdited && (
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
                <Textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setDescriptionRestored(false);
                  }}
                  placeholder={item.defaultDescription}
                  disabled={saving}
                  maxLength={2000}
                  rows={3}
                  helperText={
                    isCustomDraft
                      ? undefined
                      : `Padrão: "${item.defaultDescription}"`
                  }
                />
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>Quando dispara</span>
                  {!isCustomDraft && triggerEdited && (
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
                <Textarea
                  value={trigger}
                  onChange={(e) => {
                    setTrigger(e.target.value);
                    setTriggerRestored(false);
                  }}
                  placeholder={item.defaultTrigger}
                  disabled={saving}
                  maxLength={2000}
                  rows={2}
                  helperText={
                    isCustomDraft
                      ? undefined
                      : `Padrão: "${item.defaultTrigger}"`
                  }
                />
              </div>

              {!isCustomDraft && labelEdited && (
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldHead}>
                    <span className={styles.fieldLabel}>Nome / título</span>
                    <button
                      type="button"
                      className={styles.restoreBtn}
                      onClick={restoreLabel}
                      disabled={saving}
                    >
                      <IconRefresh size={11} />
                      Restaurar padrão
                    </button>
                  </div>
                  <Input
                    value={label}
                    onChange={(e) => {
                      setLabel(e.target.value);
                      setLabelRestored(false);
                    }}
                    placeholder={item.defaultLabel}
                    disabled={saving}
                    maxLength={200}
                    helperText={`Padrão: "${item.defaultLabel}"`}
                  />
                </div>
              )}
            </section>

            {/* ── Meta (catálogo, read-only) ─────────────── */}
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>Atributos do catálogo</span>
                <span className={styles.sectionDesc}>
                  Definidos em código. Não editáveis aqui — alteração
                  estrutural exige deploy.
                </span>
              </div>
              <div className={styles.metaGrid}>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Identificador</span>
                  <span className={styles.metaValue}>
                    <code className={styles.metaCode}>{item.kind}</code>
                  </span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Categoria</span>
                  <span className={styles.metaValue}>
                    {CATEGORY_LABEL[item.category]}
                  </span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Canais suportados</span>
                  <span className={styles.metaValue}>
                    {item.supportedChannels
                      .map((c) => CHANNEL_LABEL[c])
                      .join(' · ')}
                  </span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Canais default</span>
                  <span className={styles.metaValue}>
                    {item.defaultChannels.length > 0
                      ? item.defaultChannels
                          .map((c) => CHANNEL_LABEL[c])
                          .join(' · ')
                      : 'Nenhum (precisa habilitar manualmente)'}
                  </span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Estado em código</span>
                  <span className={styles.metaValue}>
                    {item.wired ? (
                      <span className={styles.metaInline}>
                        <IconCheckCircle size={12} /> Conectado e disparando
                      </span>
                    ) : (
                      <span className={styles.metaInline}>
                        <IconAlert size={12} /> Planejada — não dispara ainda
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
                <div className={styles.metaCell} data-full>
                  <span className={styles.metaLabel}>Última atualização</span>
                  <span className={styles.metaValue}>
                    {item.updatedAt
                      ? formatDateTime(item.updatedAt)
                      : 'Nunca editada — usando padrão do catálogo'}
                  </span>
                </div>
              </div>
            </section>

            {/* ── Testar disparo (só pros kinds wired ao cron) ─────
             * Roda o handler real (queries no DB + Resend). Sem
             * dry-run no BE — mensagem deixa explícito pra evitar
             * surpresa. Bloco fica visível só pros 3 kinds
             * conectados ao cron registry. */}
            {isTriggerable && (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionTitle}>Testar disparo</span>
                  <span className={styles.sectionDesc}>
                    Roda o cron agora, do jeito que rodaria automaticamente.
                    O email é enviado de verdade — não é simulação.
                  </span>
                </div>
                <div className={styles.triggerCard}>
                  <div className={styles.triggerCardInfo}>
                    <span className={styles.triggerCardTitle}>
                      Executar &quot;{item.label}&quot; agora
                    </span>
                    <span className={styles.triggerCardHelper}>
                      Mesmo destinatário, mesmas queries e mesmos efeitos
                      colaterais (logs, cooldowns) do cron agendado.
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    leadingIcon={<IconSend size={14} />}
                    onClick={handleTrigger}
                    loading={triggering}
                    disabled={triggering || saving}
                  >
                    {triggering ? 'Disparando…' : 'Enviar teste agora'}
                  </Button>
                </div>

                {lastTrigger && (
                  <div className={styles.triggerResult} data-tone="success">
                    <IconCheckCircle size={13} />
                    <div className={styles.triggerResultText}>
                      <strong>Último teste</strong>
                      <span>
                        {summarizeTriggerResult(item.kind, lastTrigger)}
                      </span>
                      <span className={styles.triggerResultMeta}>
                        Duração: {lastTrigger.durationMs}ms
                      </span>
                    </div>
                  </div>
                )}
                {lastTriggerError && (
                  <div className={styles.triggerResult} data-tone="error">
                    <IconAlert size={13} />
                    <div className={styles.triggerResultText}>
                      <strong>Falha no último teste</strong>
                      <span>{lastTriggerError}</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Footer com ações ───────────────────────── */}
            <footer className={styles.formFooter}>
              {isCustomDraft && (
                <Button
                  variant="dangerGhost"
                  size="md"
                  leadingIcon={<IconTrash size={14} />}
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                >
                  Excluir notificação
                </Button>
              )}
              <div className={styles.formFooterRight}>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => router.push('/notificacoes')}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  leadingIcon={<IconCheckCircle size={14} />}
                  onClick={save}
                  loading={saving}
                  disabled={!dirty}
                >
                  Salvar alterações
                </Button>
              </div>
            </footer>
          </div>
        </aside>

        <main
          className={`${styles.canvas} ${
            view === 'preview' ? styles.activeMobile : styles.hiddenMobile
          }`}
        >
          <div className={styles.previewWrap}>
            <div className={styles.previewToolbar}>
              {/* Pill toggle no padrão do DevicePreview (template
               * de email) — botão com ícone + label, active state
               * com fundo branco e shadow sutil. Três opções:
               * iPhone, Android (ambos do canal in_app) e Email. */}
              <div className={styles.previewToggle}>
                {item.supportedChannels.includes('in_app') && (
                  <>
                    <button
                      type="button"
                      className={cn(
                        styles.previewToggleBtn,
                        previewDevice === 'iphone' &&
                          styles.previewToggleActive,
                      )}
                      onClick={() => setPreviewDevice('iphone')}
                      aria-pressed={previewDevice === 'iphone'}
                    >
                      <AppleIcon />
                      iPhone
                    </button>
                    <button
                      type="button"
                      className={cn(
                        styles.previewToggleBtn,
                        previewDevice === 'android' &&
                          styles.previewToggleActive,
                      )}
                      onClick={() => setPreviewDevice('android')}
                      aria-pressed={previewDevice === 'android'}
                    >
                      <AndroidIcon />
                      Android
                    </button>
                  </>
                )}
                {item.supportedChannels.includes('email') && (
                  <button
                    type="button"
                    className={cn(
                      styles.previewToggleBtn,
                      previewDevice === 'email' &&
                        styles.previewToggleActive,
                    )}
                    onClick={() => setPreviewDevice('email')}
                    aria-pressed={previewDevice === 'email'}
                  >
                    <IconMail size={14} />
                    Email
                  </button>
                )}
              </div>
              <span className={styles.previewLegend}>
                Simulação · valores em tempo real
              </span>
            </div>

            <NotificationPreview
              device={previewDevice}
              label={label || item.defaultLabel}
              description={description || item.defaultDescription}
              trigger={trigger || item.defaultTrigger}
              category={item.category}
              channelEnabled={
                (channels[previewChannelKey] ??
                  item.defaultChannels.includes(previewChannelKey)) &&
                masterChecked
              }
            />
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          handleDelete();
        }}
        destructive
        title={`Excluir "${item.label}"?`}
        description="A notificação personalizada será removida do catálogo local. Essa ação não pode ser desfeita."
        confirmLabel="Excluir notificação"
      />
    </div>
  );
}

/** Constrói uma descrição curta do resultado do trigger pra mostrar
 *  no toast e na seção de "último teste". Cada kind tem campos
 *  diferentes na resposta — picamos os mais relevantes pra texto
 *  legível, com fallback genérico se a estrutura mudar. */
function summarizeTriggerResult(
  kind: string,
  res: CronTriggerResponse,
): string {
  const r = res.result ?? {};
  if (kind === 'manager_daily_report') {
    const to = typeof r.to === 'string' ? r.to : '';
    const totalUsers = typeof r.totalUsers === 'number' ? r.totalUsers : null;
    const newUsers = typeof r.newUsers === 'number' ? r.newUsers : null;
    const streams = typeof r.streams === 'number' ? r.streams : null;
    const sent = r.sent === true;
    const parts: string[] = [];
    if (sent && to) parts.push(`Enviado pra ${to}.`);
    if (!sent) parts.push('Cron rodou mas o email NÃO foi enviado.');
    if (totalUsers != null) parts.push(`${totalUsers} usuários ativos`);
    if (newUsers != null) parts.push(`+${newUsers} novos`);
    if (streams != null) parts.push(`${streams} streams`);
    return parts.join(' · ');
  }
  if (kind === 'daily_digest') {
    const sent = typeof r.sent === 'number' ? r.sent : null;
    const skipped = typeof r.skipped === 'number' ? r.skipped : null;
    const parts: string[] = [];
    if (sent != null) parts.push(`${sent} enviados`);
    if (skipped != null) parts.push(`${skipped} pulados`);
    return parts.join(' · ') || 'Cron rodou.';
  }
  if (kind === 'community_interactions') {
    const sent = typeof r.sent === 'number' ? r.sent : null;
    const candidates =
      typeof r.candidates === 'number' ? r.candidates : null;
    const parts: string[] = [];
    if (candidates != null) parts.push(`${candidates} candidatos`);
    if (sent != null) parts.push(`${sent} emails enviados`);
    return parts.join(' · ') || 'Cron rodou.';
  }
  return `Cron "${kind}" rodou (${res.durationMs}ms).`;
}

/* ── Inline brand icons (Apple / Android) — para os toggles de
 *    device do preview. Inline + monocromático pra herdar a cor
 *    dos botões via currentColor (mesma pegada das icons do app). */

function AppleIcon() {
  return (
    <svg
      width="13"
      height="14"
      viewBox="0 0 14 17"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.5 12c-.4.9-.6 1.3-1.1 2.1-.7 1-1.7 2.3-2.9 2.3-1.1 0-1.4-.7-2.9-.7-1.5 0-1.8.7-2.9.7-1.2 0-2.2-1.2-2.9-2.2C-.4 11.4-.6 7.9.6 5.9c.9-1.4 2.3-2.3 3.6-2.3 1.4 0 2.2.7 3.3.7 1.1 0 1.7-.7 3.3-.7 1.2 0 2.5.7 3.4 1.8-3 1.6-2.5 5.9-2.7 6.6zM9 2.4C9.5 1.7 9.9.7 9.8 0c-.7.1-1.5.5-2 1.1-.5.6-.9 1.5-.8 2.3.7.1 1.5-.3 2-1z" />
    </svg>
  );
}

function AndroidIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Cabeça do bonequinho — meia-lua + antenas + olhos. */}
      <path d="M11.6 4.2l.9-1.6a.3.3 0 1 0-.5-.3l-.9 1.6A5.4 5.4 0 0 0 8 3.5c-1.1 0-2.2.3-3.1.7L4 2.6a.3.3 0 1 0-.5.3l.9 1.5A4.6 4.6 0 0 0 2 8.4h12a4.6 4.6 0 0 0-2.4-4.2zM5.2 7c-.3 0-.6-.3-.6-.6 0-.4.3-.6.6-.6.4 0 .6.2.6.6 0 .3-.2.6-.6.6zm5.6 0c-.4 0-.6-.3-.6-.6 0-.4.2-.6.6-.6.3 0 .6.2.6.6 0 .3-.3.6-.6.6z" />
    </svg>
  );
}
