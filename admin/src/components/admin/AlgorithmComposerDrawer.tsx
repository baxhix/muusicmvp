'use client';

import { useEffect, useMemo, useState } from 'react';
import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Switch from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { IconCheckCircle, IconAlgorithm } from '@/components/icons';
import {
  ACTION_CATALOG,
  TRIGGER_CATALOG,
  algorithmService,
  defaultConfigFor,
} from '@/services/algorithm';
import {
  ALGORITHM_ACTION_KINDS,
  ALGORITHM_TRIGGER_EVENTS,
} from '@/types';
import type {
  AlgorithmActionKind,
  AlgorithmConfigField,
  AlgorithmRule,
  AlgorithmRuleInput,
  AlgorithmTriggerEvent,
} from '@/types';
import styles from './AlgorithmComposerDrawer.module.css';

/**
 * Drawer for creating + editing algorithm rules.
 *
 *   Identificação:     name, description
 *   Quando (gatilho):  triggerEvent + dinâmico triggerConfig
 *   Faz (ação):        actionKind + dinâmico actionConfig
 *   Documentação:      serviceName, targetObject, tags, docsUrl
 *   Execução:          enabled, priority, cooldown, maxPerSession
 *
 * The dynamic config sections render their fields from
 * TRIGGER_CATALOG / ACTION_CATALOG so the input set automatically
 * matches the chosen trigger/action. Switching trigger or action
 * resets the relevant config to that catalog's defaults — the
 * admin can't carry stale fields across kinds.
 */

interface Props {
  open: boolean;
  rule: AlgorithmRule | null; // null = create mode
  onClose: () => void;
  onSaved: (saved: AlgorithmRule) => void;
}

export default function AlgorithmComposerDrawer({
  open,
  rule,
  onClose,
  onSaved,
}: Props) {
  const isEdit = rule !== null;
  const { push } = useToast();

  /* ── Form state ─────────────────────────────────────── */

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [triggerEvent, setTriggerEvent] =
    useState<AlgorithmTriggerEvent>('session_started');
  const [triggerConfig, setTriggerConfig] =
    useState<Record<string, unknown>>({});

  const [actionKind, setActionKind] = useState<AlgorithmActionKind>('show_toast');
  const [actionConfig, setActionConfig] = useState<Record<string, unknown>>({});

  const [serviceName, setServiceName] = useState('');
  const [targetObject, setTargetObject] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [documentationUrl, setDocumentationUrl] = useState('');

  const [enabled, setEnabled] = useState(false);
  const [priority, setPriority] = useState<number>(100);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [maxPerSession, setMaxPerSession] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);

  // Hydrate from `rule` whenever the drawer opens or target changes.
  useEffect(() => {
    if (!open) return;
    if (rule) {
      setName(rule.name);
      setDescription(rule.description);
      setTriggerEvent(rule.triggerEvent);
      setTriggerConfig(rule.triggerConfig);
      setActionKind(rule.actionKind);
      setActionConfig(rule.actionConfig);
      setServiceName(rule.serviceName ?? '');
      setTargetObject(rule.targetObject ?? '');
      setTagsInput(rule.tags.join(', '));
      setDocumentationUrl(rule.documentationUrl ?? '');
      setEnabled(rule.enabled);
      setPriority(rule.priority);
      setCooldownSeconds(rule.cooldownSeconds);
      setMaxPerSession(rule.maxPerSession);
    } else {
      // Fresh defaults for a new rule.
      setName('');
      setDescription('');
      setTriggerEvent('session_started');
      setTriggerConfig(defaultConfigFor(TRIGGER_CATALOG['session_started']));
      setActionKind('show_toast');
      setActionConfig(defaultConfigFor(ACTION_CATALOG['show_toast']));
      setServiceName('');
      setTargetObject('');
      setTagsInput('');
      setDocumentationUrl('');
      setEnabled(false);
      setPriority(100);
      setCooldownSeconds(0);
      setMaxPerSession(0);
    }
  }, [open, rule]);

  // Whenever the trigger changes, reset its config to defaults.
  // Editing an existing rule: only kick in on user-driven changes
  // (the hydrate effect above already set the right config).
  const handleTriggerChange = (next: AlgorithmTriggerEvent) => {
    setTriggerEvent(next);
    setTriggerConfig(defaultConfigFor(TRIGGER_CATALOG[next]));
  };
  const handleActionChange = (next: AlgorithmActionKind) => {
    setActionKind(next);
    setActionConfig(defaultConfigFor(ACTION_CATALOG[next]));
  };

  /* ── Validation gate ──────────────────────────────────── */

  const blocking = useMemo<null | 'name' | 'description'>(() => {
    if (!name.trim()) return 'name';
    if (!description.trim()) return 'description';
    return null;
  }, [name, description]);

  /* ── Submit ──────────────────────────────────────────── */

  async function handleSubmit() {
    if (blocking || submitting) return;
    setSubmitting(true);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const input: AlgorithmRuleInput = {
      name: name.trim(),
      description: description.trim(),
      triggerEvent,
      triggerConfig,
      actionKind,
      actionConfig,
      serviceName: serviceName.trim() || null,
      targetObject: targetObject.trim() || null,
      tags,
      documentationUrl: documentationUrl.trim() || null,
      enabled,
      priority,
      cooldownSeconds,
      maxPerSession,
    };

    try {
      const saved = isEdit
        ? await algorithmService.update(rule!.id, input)
        : await algorithmService.create(input);
      onSaved(saved);
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

  const triggerMeta = TRIGGER_CATALOG[triggerEvent];
  const actionMeta = ACTION_CATALOG[actionKind];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Editar regra' : 'Nova regra de algoritmo'}
      description={
        isEdit
          ? 'Ajuste o gatilho, a ação ou os metadados de documentação.'
          : 'Registre um comportamento da plataforma — quando o usuário fizer X, o que a plataforma faz.'
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
            leadingIcon={<IconCheckCircle size={14} />}
          >
            {isEdit ? 'Salvar alterações' : 'Registrar regra'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {/* ── Identificação ──────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Identificação</span>
            <span className={styles.sectionHint}>
              Nome curto + descrição plena. A descrição é a fonte de verdade para
              entender o &quot;porquê&quot; da regra ao revisar depois.
            </span>
          </header>
          <Input
            inputSize="md"
            placeholder="Ex: Sugerir track parecida ao final"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            disabled={submitting}
            invalid={blocking === 'name'}
          />
          <Textarea
            placeholder="Descreva o objetivo dessa regra: quando dispara, o que ela faz, qual o impacto esperado."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            required
            disabled={submitting}
            helperText={`${description.length}/2000`}
            invalid={blocking === 'description'}
          />
        </section>

        {/* ── Quando (gatilho) ────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Quando · Gatilho</span>
            <span className={styles.sectionHint}>{triggerMeta.helper}</span>
          </header>
          <Select
            value={triggerEvent}
            onChange={(e) =>
              handleTriggerChange(e.target.value as AlgorithmTriggerEvent)
            }
            options={ALGORITHM_TRIGGER_EVENTS.map((t) => ({
              value: t,
              label: TRIGGER_CATALOG[t].label,
            }))}
            disabled={submitting}
          />
          {Object.keys(triggerMeta.fields).length > 0 && (
            <div className={styles.configGrid}>
              {Object.entries(triggerMeta.fields).map(([key, field]) => (
                <ConfigInput
                  key={key}
                  fieldKey={key}
                  field={field}
                  value={triggerConfig[key]}
                  onChange={(v) =>
                    setTriggerConfig((cfg) => ({ ...cfg, [key]: v }))
                  }
                  disabled={submitting}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Faz (ação) ──────────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Faz · Ação</span>
            <span className={styles.sectionHint}>{actionMeta.helper}</span>
          </header>
          <Select
            value={actionKind}
            onChange={(e) =>
              handleActionChange(e.target.value as AlgorithmActionKind)
            }
            options={ALGORITHM_ACTION_KINDS.map((a) => ({
              value: a,
              label: ACTION_CATALOG[a].label,
            }))}
            disabled={submitting}
          />
          {Object.keys(actionMeta.fields).length > 0 && (
            <div className={styles.configGrid}>
              {Object.entries(actionMeta.fields).map(([key, field]) => (
                <ConfigInput
                  key={key}
                  fieldKey={key}
                  field={field}
                  value={actionConfig[key]}
                  onChange={(v) =>
                    setActionConfig((cfg) => ({ ...cfg, [key]: v }))
                  }
                  disabled={submitting}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Documentação ───────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Documentação</span>
            <span className={styles.sectionHint}>
              Esses campos não afetam o disparo da regra — servem para
              navegar o catálogo conforme ele cresce.
            </span>
          </header>
          <div className={styles.configGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Serviço</span>
              <Input
                inputSize="md"
                placeholder="feed, player, chat, onboarding…"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                maxLength={80}
                disabled={submitting}
              />
              <span className={styles.fieldHelper}>
                Área da plataforma onde a regra opera.
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Objeto alvo</span>
              <Input
                inputSize="md"
                placeholder="Track, Post, User, Conversation…"
                value={targetObject}
                onChange={(e) => setTargetObject(e.target.value)}
                maxLength={80}
                disabled={submitting}
              />
              <span className={styles.fieldHelper}>
                Entidade que a ação afeta ou utiliza.
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Tags</span>
              <Input
                inputSize="md"
                placeholder="engajamento, onboarding, win-back"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                disabled={submitting}
              />
              <span className={styles.fieldHelper}>Separadas por vírgula.</span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Link para docs (opcional)</span>
              <Input
                inputSize="md"
                placeholder="https://notion.so/…"
                value={documentationUrl}
                onChange={(e) => setDocumentationUrl(e.target.value)}
                maxLength={500}
                disabled={submitting}
              />
              <span className={styles.fieldHelper}>
                Aponta para a descrição completa no Notion / wiki.
              </span>
            </label>
          </div>
        </section>

        {/* ── Execução ────────────────────────────────── */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Execução</span>
            <span className={styles.sectionHint}>
              Controles que o engine respeita quando a regra dispara.
              <br />
              <strong>Phase 1:</strong> o engine ainda não está em produção —
              esses valores ficam salvos para quando ele subir.
            </span>
          </header>
          <div className={styles.activeRow}>
            <div className={styles.activeRowText}>
              <span className={styles.activeRowTitle}>Regra ativa</span>
              <span className={styles.activeRowHint}>
                Desligue para arquivar sem perder a configuração.
              </span>
            </div>
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={submitting}
              aria-label="Ativar/desativar regra"
            />
          </div>
          <div className={styles.configGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Prioridade</span>
              <Input
                inputSize="md"
                type="number"
                value={String(priority)}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={0}
                max={1000}
                disabled={submitting}
              />
              <span className={styles.fieldHelper}>
                Menor número = maior prioridade quando duas regras casarem ao mesmo tempo.
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Cooldown (s)</span>
              <Input
                inputSize="md"
                type="number"
                value={String(cooldownSeconds)}
                onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                min={0}
                max={86400}
                disabled={submitting}
              />
              <span className={styles.fieldHelper}>
                Tempo mínimo entre dois disparos da mesma regra para o mesmo usuário.
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Máximo por sessão</span>
              <Input
                inputSize="md"
                type="number"
                value={String(maxPerSession)}
                onChange={(e) => setMaxPerSession(Number(e.target.value))}
                min={0}
                max={100}
                disabled={submitting}
              />
              <span className={styles.fieldHelper}>
                0 = ilimitado. Útil para evitar spam dentro de uma única visita.
              </span>
            </label>
          </div>
        </section>
      </div>
    </Drawer>
  );
}

/* ── Single config field renderer ─────────────────────────────
 * Switches between Input / Select / Switch based on the field
 * `kind`. Kept inline because it has no value standalone — it's
 * tightly coupled to the catalog shape declared in the service. */

function ConfigInput({
  fieldKey,
  field,
  value,
  onChange,
  disabled,
}: {
  fieldKey: string;
  field: AlgorithmConfigField;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  // Fall back to the catalog default if the value is still missing
  // — happens when an admin opens an old rule whose schema gained
  // a new field after the row was last saved.
  const effective = value ?? field.defaultValue;

  if (field.kind === 'enum') {
    return (
      <label className={styles.field} key={fieldKey}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <Select
          value={String(effective)}
          onChange={(e) => onChange(e.target.value)}
          options={field.options.map((o) => ({ value: o, label: o }))}
          disabled={disabled}
        />
        {field.helper && (
          <span className={styles.fieldHelper}>{field.helper}</span>
        )}
      </label>
    );
  }
  if (field.kind === 'number') {
    return (
      <label className={styles.field} key={fieldKey}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <Input
          inputSize="md"
          type="number"
          value={String(effective)}
          onChange={(e) => onChange(Number(e.target.value))}
          min={field.min}
          max={field.max}
          disabled={disabled}
        />
        {field.helper && (
          <span className={styles.fieldHelper}>{field.helper}</span>
        )}
      </label>
    );
  }
  if (field.kind === 'boolean') {
    return (
      <div className={styles.field} key={fieldKey}>
        <div className={styles.activeRow}>
          <div className={styles.activeRowText}>
            <span className={styles.activeRowTitle}>{field.label}</span>
            {field.helper && (
              <span className={styles.activeRowHint}>{field.helper}</span>
            )}
          </div>
          <Switch
            checked={Boolean(effective)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            aria-label={field.label}
          />
        </div>
      </div>
    );
  }
  // string
  return (
    <label className={styles.field} key={fieldKey}>
      <span className={styles.fieldLabel}>{field.label}</span>
      <Input
        inputSize="md"
        value={String(effective ?? '')}
        onChange={(e) => onChange(e.target.value)}
        maxLength={field.maxLength}
        disabled={disabled}
      />
      {field.helper && (
        <span className={styles.fieldHelper}>{field.helper}</span>
      )}
    </label>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'name_required':         return 'Dê um nome para a regra.';
    case 'description_required':  return 'Descreva o objetivo da regra.';
    case 'name_too_long':         return 'Nome ultrapassou 200 caracteres.';
    case 'description_too_long':  return 'Descrição ultrapassou 2.000 caracteres.';
    case 'invalid_trigger':       return 'Gatilho inválido.';
    case 'invalid_action':        return 'Ação inválida.';
    case 'invalid_priority':      return 'Prioridade precisa ser positiva.';
    case 'invalid_cooldown':      return 'Cooldown precisa ser positivo.';
    case 'rule_not_found':        return 'Regra não encontrada.';
    default:                      return 'Tente novamente em instantes.';
  }
}
