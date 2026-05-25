'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table, { type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import {
  IconBell,
  IconCheckCircle,
  IconBan,
  IconAlert,
  IconMail,
  IconSearch,
  IconShield,
} from '@/components/icons';
import {
  notificationsService,
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  type NotificationItem,
  type NotificationCategory,
} from '@/services/notifications';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import styles from './page.module.css';

/**
 * Notificações — listagem em tabela (padrão Users / Materiais) com
 * filtros no topo. Categoria virou COLUNA + FILTRO (chip), não mais
 * seção. Clicar numa linha NAVEGA pra `/notificacoes/[kind]`, página
 * dedicada de edição com sidebar + preview mockup do canal (in-app
 * + email).
 *
 * Toggle de master (ligado/desligado) e canais ficam dentro da
 * página de edição — esta listagem é read-only com ícones que
 * mostram o estado salvo.
 */

const STATUS_OPTIONS = [
  { value: '',         label: 'Todos os status' },
  { value: 'enabled',  label: 'Ativas' },
  { value: 'disabled', label: 'Desativadas' },
  { value: 'system',   label: 'Sistema (sempre ativo)' },
];

const WIRED_OPTIONS = [
  { value: '',        label: 'Estado: todos' },
  { value: 'wired',   label: 'Conectadas (em produção)' },
  { value: 'planned', label: 'Planejadas (roadmap)' },
];

const CATEGORY_OPTIONS: { value: '' | NotificationCategory; label: string }[] = [
  { value: '',           label: 'Todas as categorias' },
  { value: 'lifecycle',  label: CATEGORY_LABEL.lifecycle },
  { value: 'social',     label: CATEGORY_LABEL.social },
  { value: 'content',    label: CATEGORY_LABEL.content },
  { value: 'engagement', label: CATEGORY_LABEL.engagement },
];

export default function NotificacoesPage() {
  const { push } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    category: '' as '' | NotificationCategory,
    status: '' as '' | 'enabled' | 'disabled' | 'system',
    wired: '' as '' | 'wired' | 'planned',
  });

  useEffect(() => {
    notificationsService
      .list()
      .then((res) => setItems(res.items))
      .catch((err: unknown) => {
        push({
          type: 'error',
          title: 'Erro ao carregar notificações',
          description: err instanceof Error ? err.message : '',
        });
        setItems([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Stats globais — sempre baseado em todos os items, não no
   * filtrado, pra dar uma visão real do catálogo. */
  const stats = useMemo(() => {
    if (!items) return null;
    const wired = items.filter((i) => i.wired).length;
    const active = items.filter((i) => i.wired && i.enabled).length;
    const planned = items.filter((i) => !i.wired).length;
    return { total: items.length, wired, active, planned };
  }, [items]);

  /* useDeferredValue desacopla a digitação do recálculo do filter —
   * mesmo padrão da página de usuários. */
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(() => {
    if (!items) return [];
    const q = deferredFilters.search.trim().toLowerCase();
    return items.filter((i) => {
      if (q) {
        const hay =
          `${i.label} ${i.kind} ${i.description} ${i.trigger}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (deferredFilters.category && i.category !== deferredFilters.category) {
        return false;
      }
      if (deferredFilters.status) {
        if (deferredFilters.status === 'system' && !i.system) return false;
        if (deferredFilters.status === 'enabled' && (!i.enabled || i.system))
          return false;
        if (deferredFilters.status === 'disabled' && (i.enabled || i.system))
          return false;
      }
      if (deferredFilters.wired) {
        if (deferredFilters.wired === 'wired' && !i.wired) return false;
        if (deferredFilters.wired === 'planned' && i.wired) return false;
      }
      return true;
    });
  }, [items, deferredFilters]);

  function openEditor(item: NotificationItem) {
    router.push(`/notificacoes/${encodeURIComponent(item.kind)}`);
  }

  /* Columns memoizados — definição estática + closures sobre setters
   * estáveis do useState. Sem isto, cada keystroke do filter
   * recriava cells e forçava remount da Table inteira. */
  const columns: Column<NotificationItem>[] = useMemo(
    () => [
      {
        id: 'notification',
        header: 'Notificação',
        sortKey: (i) => i.label,
        cell: (i) => (
          <div className={styles.cellMain}>
            <div className={styles.cellMainHead}>
              <span className={styles.cellTitle}>{i.label}</span>
              {(i.hasLabelOverride ||
                i.hasDescriptionOverride ||
                i.hasTriggerOverride) && (
                <Badge tone="brand" size="sm">
                  Editado
                </Badge>
              )}
            </div>
            <span className={styles.cellDescription}>{i.description}</span>
            <code className={styles.cellKind}>{i.kind}</code>
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Categoria',
        sortKey: (i) => i.category,
        cell: (i) => (
          <Badge tone="neutral" size="sm">
            {CATEGORY_LABEL[i.category]}
          </Badge>
        ),
        width: 160,
      },
      {
        id: 'channels',
        header: 'Canais',
        sortKey: (i) => i.supportedChannels.length,
        cell: (i) => (
          <div className={styles.cellChannels}>
            {i.supportedChannels.map((ch) => {
              const active = i.channels[ch] ?? i.defaultChannels.includes(ch);
              const on = active && (i.enabled || i.system);
              const Icon = ch === 'email' ? IconMail : IconBell;
              return (
                <span
                  key={ch}
                  className={cn(styles.chPill, on && styles.chPillOn)}
                  title={`${CHANNEL_LABEL[ch]} ${on ? '— ligado' : '— desligado'}`}
                >
                  <Icon size={11} />
                  {CHANNEL_LABEL[ch]}
                </span>
              );
            })}
          </div>
        ),
        width: 200,
      },
      {
        id: 'status',
        header: 'Status',
        sortKey: (i) => (i.system ? 0 : i.enabled ? 1 : 2),
        cell: (i) => {
          if (i.system) {
            return (
              <span className={styles.statusSystem}>
                <IconShield size={11} />
                Sistema
              </span>
            );
          }
          if (i.enabled) {
            return (
              <span className={styles.statusOn}>
                <span className={cn(styles.statusDot, styles.statusDotOn)} />
                Ativa
              </span>
            );
          }
          return (
            <span className={styles.statusOff}>
              <span className={styles.statusDot} />
              Desativada
            </span>
          );
        },
        width: 130,
      },
      {
        id: 'wired',
        header: 'Implementação',
        sortKey: (i) => (i.wired ? 0 : 1),
        cell: (i) =>
          i.wired ? (
            <Badge tone="success" size="sm" dot>
              Em produção
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm">
              Planejada
            </Badge>
          ),
        width: 140,
      },
    ],
    [],
  );

  const filterCount =
    (filters.search ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.wired ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Notificações"
        description="Catálogo de notificações que a plataforma dispara — no app e por email. Clique numa linha pra editar o conteúdo, canais e estado. Sistema (login etc.) não pode ser desligado."
      />

      <div className={styles.body}>
        {/* KPIs */}
        <div className={styles.kpiGrid}>
          <StatCard
            icon={<IconBell size={14} />}
            value={stats ? formatNumber(stats.total) : '—'}
            label="Tipos no catálogo"
          />
          <StatCard
            icon={<IconCheckCircle size={14} />}
            value={stats ? formatNumber(stats.active) : '—'}
            label="Ativas em produção"
            secondary={
              stats && stats.wired > 0
                ? `${Math.round((stats.active / stats.wired) * 100)}%`
                : undefined
            }
          />
          <StatCard
            icon={<IconBan size={14} />}
            value={stats ? formatNumber(stats.wired - stats.active) : '—'}
            label="Wired · desativadas"
          />
          <StatCard
            icon={<IconAlert size={14} />}
            value={stats ? formatNumber(stats.planned) : '—'}
            label="Planejadas (roadmap)"
          />
        </div>

        {/* Tabela com filtros */}
        <Card>
          <CardHeader
            title="Catálogo de notificações"
            description="Listagem completa. Use os filtros pra restringir por categoria, status ou estado de implementação."
          />

          <div className={styles.filters}>
            <Input
              inputSize="md"
              placeholder="Buscar por nome, kind ou descrição…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              leadingIcon={<IconSearch size={14} />}
            />
            <Select
              inputSize="md"
              value={filters.category}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  category: e.target.value as '' | NotificationCategory,
                })
              }
              options={CATEGORY_OPTIONS}
            />
            <Select
              inputSize="md"
              value={filters.status}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value as typeof filters.status,
                })
              }
              options={STATUS_OPTIONS}
            />
            <Select
              inputSize="md"
              value={filters.wired}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  wired: e.target.value as typeof filters.wired,
                })
              }
              options={WIRED_OPTIONS}
            />
          </div>

          {filterCount > 0 && (
            <div className={styles.filterSummary}>
              <span>
                {filtered.length} de {items?.length ?? 0} notificações
              </span>
              <button
                type="button"
                className={styles.clearFilters}
                onClick={() =>
                  setFilters({ search: '', category: '', status: '', wired: '' })
                }
              >
                Limpar filtros
              </button>
            </div>
          )}

          <Table<NotificationItem>
            columns={columns}
            data={filtered}
            rowId={(i) => i.kind}
            onRowClick={openEditor}
            pageSize={15}
            loading={items === null}
            emptyState={
              <div className={styles.emptyState}>
                <IconBell size={20} />
                <span>Nenhuma notificação corresponde aos filtros.</span>
              </div>
            }
          />
        </Card>
      </div>
    </>
  );
}
