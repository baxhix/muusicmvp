'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table, { type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import NewNotificationDialog from '@/components/admin/NewNotificationDialog';
import Tabs from '@/components/ui/Tabs';
import {
  IconBell,
  IconCheckCircle,
  IconBan,
  IconAlert,
  IconMail,
  IconSearch,
  IconShield,
  IconPlus,
} from '@/components/icons';
import {
  notificationsService,
  loadCustomDrafts,
  isCustomDraftKind,
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

/* Tabs de canal no topo da listagem — segregação cross-cutting
 * dos canais. "Plataforma" = notificações que aparecem dentro do
 * app (in_app); "App Push" = push notifications (planejado, sem
 * suporte hoje no catálogo). E-mail é tratado em /admin/emails. */
type ChannelTabId = 'platform' | 'push';

const CHANNEL_TABS: { id: ChannelTabId; label: string }[] = [
  { id: 'platform', label: 'Plataforma' },
  { id: 'push',     label: 'App (Push Notification)' },
];

export default function NotificacoesPage() {
  const { push } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [channelTab, setChannelTab] = useState<ChannelTabId>('platform');
  const [filters, setFilters] = useState({
    search: '',
    category: '' as '' | NotificationCategory,
    status: '' as '' | 'enabled' | 'disabled' | 'system',
    wired: '' as '' | 'wired' | 'planned',
  });
  const [createOpen, setCreateOpen] = useState(false);

  /* Drafts personalizados (localStorage) — merged com o catálogo
   * do servidor. Os drafts ficam DEPOIS dos itens do catálogo na
   * lista, pra preservar a ordem oficial e empurrar os custom pro
   * fim da paginação. */
  useEffect(() => {
    notificationsService
      .list()
      .then((res) => {
        const drafts = loadCustomDrafts();
        setItems([...res.items, ...drafts]);
      })
      .catch((err: unknown) => {
        push({
          type: 'error',
          title: 'Erro ao carregar notificações',
          description: err instanceof Error ? err.message : '',
        });
        /* Mesmo se a API falhar, tenta carregar drafts locais. */
        setItems(loadCustomDrafts());
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreated(draft: NotificationItem) {
    setCreateOpen(false);
    setItems((prev) => (prev ? [...prev, draft] : [draft]));
    /* Navega direto pro editor — UX típica de "criou, agora edita". */
    router.push(`/notificacoes/${encodeURIComponent(draft.kind)}`);
  }

  /* Items restritos pela tab de canal ativa. A tab é dimensão
   * primária da view — stats, filters e tabela todos derivam
   * desse subset, pra que os KPIs reflitam o tab selecionado. */
  const itemsForChannel = useMemo(() => {
    if (!items) return null;
    if (channelTab === 'platform') {
      return items.filter((i) => i.supportedChannels.includes('in_app'));
    }
    /* App (Push Notification): canal `push` não existe no enum hoje
     * (NotificationChannel = 'in_app' | 'email'). Como não há
     * notificações ainda com push, retornamos lista vazia — a aba
     * mostra empty state "em breve". Quando push for adicionado ao
     * catálogo basta trocar pra `i.supportedChannels.includes('push')`. */
    return [];
  }, [items, channelTab]);

  /* Stats — derivados do itemsForChannel pra refletir o tab. */
  const stats = useMemo(() => {
    if (!itemsForChannel) return null;
    const wired = itemsForChannel.filter((i) => i.wired).length;
    const active = itemsForChannel.filter((i) => i.wired && i.enabled).length;
    const planned = itemsForChannel.filter((i) => !i.wired).length;
    return { total: itemsForChannel.length, wired, active, planned };
  }, [itemsForChannel]);

  /* useDeferredValue desacopla a digitação do recálculo do filter —
   * mesmo padrão da página de usuários. */
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(() => {
    if (!itemsForChannel) return [];
    const q = deferredFilters.search.trim().toLowerCase();
    return itemsForChannel.filter((i) => {
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
        cell: (i) => {
          /* Detecta draft personalizado — drafts NÃO têm `wired` e
           * vivem em localStorage. Aqui o sinal: kind existe no
           * store de drafts. (Não usamos isCustomDraftKind aqui em
           * loop pra evitar localStorage thrashing — em vez disso,
           * inferimos pelo `wired === false && system === false`
           * combinado com a presença em loadCustomDrafts no mount.
           * Fallback simples: usa o helper, é fast pra <50 drafts.) */
          const isCustom = isCustomDraftKind(i.kind);
          return (
            <div className={styles.cellMain}>
              <div className={styles.cellMainHead}>
                <span className={styles.cellTitle}>{i.label}</span>
                {isCustom ? (
                  <Badge tone="info" size="sm" dot>
                    Personalizada
                  </Badge>
                ) : (
                  (i.hasLabelOverride ||
                    i.hasDescriptionOverride ||
                    i.hasTriggerOverride) && (
                    <Badge tone="brand" size="sm">
                      Editado
                    </Badge>
                  )
                )}
              </div>
              <span className={styles.cellDescription}>{i.description}</span>
              <code className={styles.cellKind}>{i.kind}</code>
            </div>
          );
        },
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
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<IconPlus size={14} />}
            onClick={() => setCreateOpen(true)}
          >
            Nova notificação
          </Button>
        }
      />

      <div className={styles.body}>
        {/* Tabs de canal — dimensão primária. Plataforma = in_app
         * (sino dentro do app); App Push = push notification, ainda
         * sem suporte no catálogo. E-mail vive em /admin/emails. */}
        <Tabs<ChannelTabId>
          items={CHANNEL_TABS}
          value={channelTab}
          onChange={setChannelTab}
          variant="bordered"
        />

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
                {filtered.length} de {itemsForChannel?.length ?? 0} notificações
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
              channelTab === 'push' ? (
                <div className={styles.emptyState}>
                  <IconAlert size={20} />
                  <span>
                    Push notifications em breve — canal ainda não está
                    wired no catálogo. Quando subir, as notificações
                    aparecem aqui.
                  </span>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <IconBell size={20} />
                  <span>Nenhuma notificação corresponde aos filtros.</span>
                </div>
              )
            }
          />
        </Card>
      </div>

      <NewNotificationDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existingKinds={items?.map((i) => i.kind) ?? []}
        onCreated={handleCreated}
      />
    </>
  );
}
