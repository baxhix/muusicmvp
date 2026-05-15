'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Switch from '@/components/ui/Switch';
import Table, { type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Dialog';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconAlgorithm,
} from '@/components/icons';
import AlgorithmComposerDrawer from '@/components/admin/AlgorithmComposerDrawer';
import { algorithmService, ACTION_CATALOG, TRIGGER_CATALOG } from '@/services/algorithm';
import type {
  AlgorithmActionKind,
  AlgorithmRule,
  AlgorithmTriggerEvent,
} from '@/types';
import { ALGORITHM_ACTION_KINDS, ALGORITHM_TRIGGER_EVENTS } from '@/types';
import styles from './page.module.css';

/**
 * Algoritmo CMS — listing + CRUD entry point.
 *
 * Each row in the table is a single IF/THEN rule. The composer
 * drawer handles create + edit. Quick actions:
 *   - toggle `enabled` (optimistic, rollback on failure)
 *   - delete (confirm dialog, refetch on failure)
 *
 * The list query supports search + trigger + action + enabled
 * filters mirroring the API. Defaults to "all" so the team can
 * browse the full catalog as it grows.
 *
 * Phase 1: registration only — these rules persist and surface as
 * documentation. The /app-side engine that consumes them is
 * follow-up work.
 */

const TRIGGER_OPTIONS = [
  { value: 'all', label: 'Todos os gatilhos' },
  ...ALGORITHM_TRIGGER_EVENTS.map((t) => ({
    value: t,
    label: TRIGGER_CATALOG[t].label,
  })),
];

const ACTION_OPTIONS = [
  { value: 'all', label: 'Todas as ações' },
  ...ALGORITHM_ACTION_KINDS.map((a) => ({
    value: a,
    label: ACTION_CATALOG[a].label,
  })),
];

const ENABLED_OPTIONS = [
  { value: 'all',   label: 'Todos os estados' },
  { value: 'true',  label: 'Ativas' },
  { value: 'false', label: 'Inativas' },
];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AlgoritmoPage() {
  const { push } = useToast();
  const [items, setItems] = useState<AlgorithmRule[] | null>(null);

  const [filters, setFilters] = useState<{
    triggerEvent: AlgorithmTriggerEvent | 'all';
    actionKind:   AlgorithmActionKind   | 'all';
    enabled:      'true' | 'false'      | 'all';
    search:       string;
  }>({
    triggerEvent: 'all',
    actionKind:   'all',
    enabled:      'all',
    search:       '',
  });

  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<AlgorithmRule | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AlgorithmRule | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await algorithmService.list({
        triggerEvent: filters.triggerEvent,
        actionKind:   filters.actionKind,
        enabled:      filters.enabled,
        search:       filters.search.trim() || undefined,
        limit:        200,
      });
      setItems(res.items);
    } catch (err) {
      console.error('algorithm rules list failed:', err);
      setItems([]);
      push({
        type: 'error',
        title: 'Falha ao carregar as regras',
        description: 'Tente recarregar a página em instantes.',
      });
    }
  }, [filters, push]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /* ── Actions ───────────────────────────────────────── */

  const openCreate = () => {
    setEditing(null);
    setComposerOpen(true);
  };
  const openEdit = (rule: AlgorithmRule) => {
    setEditing(rule);
    setComposerOpen(true);
  };

  const replaceLocal = (next: AlgorithmRule) => {
    setItems((prev) =>
      prev ? prev.map((p) => (p.id === next.id ? next : p)) : prev,
    );
  };

  const toggleEnabled = async (rule: AlgorithmRule, nextEnabled: boolean) => {
    replaceLocal({ ...rule, enabled: nextEnabled });
    try {
      const next = await algorithmService.update(rule.id, { enabled: nextEnabled });
      replaceLocal(next);
    } catch (err) {
      console.error('toggleEnabled failed:', err);
      replaceLocal(rule);
      push({ type: 'error', title: 'Falha ao alterar o estado' });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await algorithmService.remove(target.id);
      setItems((prev) => (prev ? prev.filter((p) => p.id !== target.id) : prev));
      push({
        type: 'success',
        title: 'Regra removida',
        description: `"${target.name}" foi apagada.`,
      });
    } catch (err) {
      console.error('delete failed:', err);
      push({ type: 'error', title: 'Não foi possível remover' });
    }
  };

  /* ── Render ─────────────────────────────────────────── */

  const columns = useMemo<Column<AlgorithmRule>[]>(
    () => [
      {
        id: 'name',
        header: 'Regra',
        cell: (rule: AlgorithmRule) => (
          <div className={styles.cellName}>
            <span className={styles.iconWrap}><IconAlgorithm size={14} /></span>
            <div className={styles.cellNameBody}>
              <div className={styles.cellTitle} title={rule.name}>
                {rule.name}
              </div>
              <div className={styles.cellDescription} title={rule.description}>
                {rule.description}
              </div>
              {rule.tags.length > 0 && (
                <div className={styles.tagsRow}>
                  {rule.tags.slice(0, 4).map((t: string) => (
                    <span key={t} className={styles.tag}>
                      {t}
                    </span>
                  ))}
                  {rule.tags.length > 4 && (
                    <span className={styles.tagMore}>+{rule.tags.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'trigger',
        header: 'Quando',
        cell: (rule: AlgorithmRule) => (
          <div className={styles.cellBlock}>
            <span className={styles.cellHead}>
              {TRIGGER_CATALOG[rule.triggerEvent].label}
            </span>
            <span className={styles.cellSub}>
              {summarizeConfig(rule.triggerEvent, rule.triggerConfig)}
            </span>
          </div>
        ),
      },
      {
        id: 'action',
        header: 'Faz',
        cell: (rule: AlgorithmRule) => (
          <div className={styles.cellBlock}>
            <span className={styles.cellHead}>
              {ACTION_CATALOG[rule.actionKind].label}
            </span>
            <span className={styles.cellSub}>
              {summarizeActionConfig(rule.actionKind, rule.actionConfig)}
            </span>
          </div>
        ),
      },
      {
        id: 'service',
        header: 'Serviço · Objeto',
        cell: (rule: AlgorithmRule) => (
          <div className={styles.cellBlock}>
            <span className={styles.cellHead}>
              {rule.serviceName || '—'}
            </span>
            <span className={styles.cellSub}>
              {rule.targetObject || '—'}
            </span>
          </div>
        ),
      },
      {
        id: 'enabled',
        header: 'Ativa',
        cell: (rule: AlgorithmRule) => (
          <Switch
            checked={rule.enabled}
            onChange={(e) => toggleEnabled(rule, e.target.checked)}
            aria-label={rule.enabled ? 'Desativar regra' : 'Ativar regra'}
          />
        ),
      },
      {
        id: 'updated',
        header: 'Atualizada',
        cell: (rule: AlgorithmRule) => (
          <span className={styles.cellSub}>{formatDateTime(rule.updatedAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: (rule: AlgorithmRule) => (
          <div className={styles.rowActions}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(rule)}
              aria-label="Editar"
              title="Editar"
              leadingIcon={<IconEdit size={13} />}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingDelete(rule)}
              aria-label="Remover"
              title="Remover"
              leadingIcon={<IconTrash size={13} />}
            >
              Remover
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Algoritmo"
        description="Catálogo de comportamentos automáticos que a plataforma executa de acordo com a atividade do usuário."
        actions={
          <Button
            variant="primary"
            size="md"
            leadingIcon={<IconPlus size={14} />}
            onClick={openCreate}
          >
            Nova regra
          </Button>
        }
      />

      {/* ── Filtros ───────────────────────────────────────── */}
      <Card className={styles.filters}>
        <div className={styles.filtersRow}>
          <Input
            inputSize="md"
            placeholder="Buscar por nome, descrição ou serviço…"
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            leadingIcon={<IconSearch size={14} />}
          />
          <Select
            value={filters.triggerEvent}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                triggerEvent: e.target.value as typeof f.triggerEvent,
              }))
            }
            options={TRIGGER_OPTIONS}
          />
          <Select
            value={filters.actionKind}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                actionKind: e.target.value as typeof f.actionKind,
              }))
            }
            options={ACTION_OPTIONS}
          />
          <Select
            value={filters.enabled}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                enabled: e.target.value as typeof f.enabled,
              }))
            }
            options={ENABLED_OPTIONS}
          />
        </div>
      </Card>

      {/* ── Lista ─────────────────────────────────────────── */}
      <Card className={styles.tableCard}>
        {items === null ? (
          <div className={styles.loading}>Carregando regras…</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma regra cadastrada"
            description="Comece registrando o primeiro comportamento automático que a plataforma deve ter quando o usuário fizer X."
            actions={
              <Button
                variant="primary"
                size="md"
                leadingIcon={<IconPlus size={14} />}
                onClick={openCreate}
              >
                Criar primeira regra
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={items}
            rowId={(r: AlgorithmRule) => r.id}
          />
        )}
      </Card>

      {/* ── Drawer composer ────────────────────────────── */}
      <AlgorithmComposerDrawer
        open={composerOpen}
        rule={editing}
        onClose={() => setComposerOpen(false)}
        onSaved={(saved) => {
          if (editing) {
            replaceLocal(saved);
            push({
              type: 'success',
              title: 'Regra atualizada',
              description: `"${saved.name}" foi salva.`,
            });
          } else {
            setItems((prev) => (prev ? [saved, ...prev] : [saved]));
            push({
              type: 'success',
              title: 'Regra criada',
              description: `"${saved.name}" foi registrada${saved.enabled ? ' e está ativa.' : ' como inativa.'}`,
            });
          }
        }}
      />

      {/* ── Confirm delete ────────────────────────────── */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Remover regra?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" será apagada. Essa ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Remover"
        destructive
      />
    </div>
  );
}

/** Inline summary for the "Quando" column — keeps the row compact
 *  by skipping fields with default-ish values. */
function summarizeConfig(
  event: AlgorithmTriggerEvent,
  config: Record<string, unknown>,
): string {
  switch (event) {
    case 'idle_in_screen': {
      const screen = (config.screen as string) || 'any';
      const seconds = (config.seconds as number) ?? 30;
      return `${seconds}s · ${screen === 'any' ? 'qualquer tela' : screen}`;
    }
    case 'feed_scroll_streak':
      return `${(config.count as number) ?? 10} posts sem engajamento`;
    case 'time_in_app_minutes':
      return `${(config.minutes as number) ?? 15} min no app`;
    case 'consecutive_inactive_days':
      return `${(config.days as number) ?? 3} dias inativos`;
    case 'session_started':
    case 'track_completed':
    case 'track_skipped':
      return 'sem condições';
    default:
      return '';
  }
}

function summarizeActionConfig(
  action: AlgorithmActionKind,
  config: Record<string, unknown>,
): string {
  switch (action) {
    case 'show_toast': {
      const title = (config.title as string) || '';
      return title || 'sem título';
    }
    case 'nudge_to_screen': {
      const screen = (config.screen as string) || 'feed';
      return `para ${screen}`;
    }
    case 'inject_recommendation': {
      const kind = (config.kind as string) || 'similar_track';
      return kind.replace(/_/g, ' ');
    }
    case 'show_modal': {
      const title = (config.title as string) || '';
      return title || 'sem título';
    }
    default:
      return '';
  }
}
