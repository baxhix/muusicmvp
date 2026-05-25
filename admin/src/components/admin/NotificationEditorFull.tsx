'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
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
} from '@/components/icons';
import NotificationPreview from './NotificationPreview';
import {
  notificationsService,
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  type NotificationItem,
  type NotificationChannel,
} from '@/services/notifications';
import { formatDateTime } from '@/lib/format';
import styles from './NotificationEditorFull.module.css';

interface NotificationEditorFullProps {
  item: NotificationItem;
}

type ViewMode = 'editor' | 'preview';
type PreviewChannel = 'in_app' | 'email';

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
  const labelInputRef = useRef<HTMLInputElement>(null);

  /* Mobile alterna entre editor/preview via tabs. */
  const [view, setView] = useState<ViewMode>('editor');

  /* Preview canvas tem seu próprio toggle in_app vs email — só
   * mostra a aba quando o canal é supported. */
  const initialPreviewChannel: PreviewChannel = item.supportedChannels.includes(
    'in_app',
  )
    ? 'in_app'
    : 'email';
  const [previewChannel, setPreviewChannel] = useState<PreviewChannel>(
    initialPreviewChannel,
  );

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

  return (
    <div className={styles.root}>
      {/* ── Topbar ──────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.topbarRow1}>
          <nav className={styles.breadcrumb} aria-label="Navegação">
            <Link href="/notificacoes" className={styles.bcLink}>
              Notificações
            </Link>
            <span className={styles.bcSep} aria-hidden="true">/</span>
            <span className={styles.bcCurrent}>{label || item.kind}</span>
          </nav>

          <div className={styles.topbarActions}>
            <label
              className={styles.activeToggle}
              title={
                isSystem
                  ? 'Notificação de sistema — sempre ativa'
                  : enabled
                    ? 'Clique pra desativar'
                    : 'Clique pra ativar'
              }
            >
              <input
                type="checkbox"
                checked={masterChecked}
                disabled={isSystem || saving}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>{masterChecked ? 'Ativa' : 'Desativada'}</span>
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/notificacoes')}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<IconCheckCircle size={14} />}
              onClick={save}
              loading={saving}
              disabled={!dirty}
            >
              Salvar alterações
            </Button>
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
          <div className={styles.titleMeta}>
            <code className={styles.kindBadge}>{item.kind}</code>
            <Badge tone="neutral" size="sm">
              {CATEGORY_LABEL[item.category]}
            </Badge>
            {isSystem ? (
              <Badge tone="warning" size="sm">Sistema</Badge>
            ) : item.wired ? (
              <Badge tone="success" size="sm" dot>Em produção</Badge>
            ) : (
              <Badge tone="neutral" size="sm">Planejada</Badge>
            )}
            {(labelEdited || descriptionEdited || triggerEdited) && (
              <Badge tone="brand" size="sm">Editado</Badge>
            )}
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
                  Personalize o texto. Deixe igual ao padrão pra voltar ao
                  copy do catálogo.
                </span>
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>Descrição</span>
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
                  helperText={`Padrão: "${item.defaultDescription}"`}
                />
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.fieldHead}>
                  <span className={styles.fieldLabel}>Quando dispara</span>
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
                  helperText={`Padrão: "${item.defaultTrigger}"`}
                />
              </div>

              {labelEdited && (
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
          </div>
        </aside>

        <main
          className={`${styles.canvas} ${
            view === 'preview' ? styles.activeMobile : styles.hiddenMobile
          }`}
        >
          <div className={styles.previewWrap}>
            <div className={styles.previewToolbar}>
              <Tabs<PreviewChannel>
                items={[
                  ...(item.supportedChannels.includes('in_app')
                    ? [{ id: 'in_app' as const, label: 'No app' }]
                    : []),
                  ...(item.supportedChannels.includes('email')
                    ? [{ id: 'email' as const, label: 'Email' }]
                    : []),
                ]}
                value={previewChannel}
                onChange={setPreviewChannel}
                variant="pills"
              />
              <span className={styles.previewLegend}>
                Simulação · valores em tempo real
              </span>
            </div>

            <NotificationPreview
              channel={previewChannel}
              label={label || item.defaultLabel}
              description={description || item.defaultDescription}
              trigger={trigger || item.defaultTrigger}
              category={item.category}
              channelEnabled={
                (channels[previewChannel] ??
                  item.defaultChannels.includes(previewChannel)) &&
                masterChecked
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}
