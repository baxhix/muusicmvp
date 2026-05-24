'use client';

import { useEffect, useMemo, useState } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table, { type Column } from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import {
  IconChevronLeft,
  IconDownload,
  IconSearch,
  IconShield,
  IconCheck,
  IconX,
  IconUsers,
  IconMusic,
  IconFeed,
  IconBan,
  IconKey,
  IconCalendar,
  IconChevronRight,
  IconSettings,
} from '@/components/icons';
import { MOCK_USERS } from '@/data/mock/users';
import {
  generateUserActivities,
  summarizeActivities,
} from '@/services/userActivities';
import { usersService } from '@/services/users';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  UserActivityCategory,
  UserActivityEvent,
  UserActivityResult,
} from '@/types';
import styles from './page.module.css';

/**
 * Activity log for a single user.
 *
 *   /admin/users/:id/activities
 *
 * Two layers:
 *   - "Real data" path: when the eventual /api/admin/users/:id/
 *     activities endpoint ships, swap the generateUserActivities()
 *     call for a fetch. The page rendering is agnostic.
 *   - Mock fallback: deterministic generator seeded by user.id so
 *     reloading the same user always produces the same rows.
 *
 * Built for compliance review (LGPD) — every row carries enough
 * context (timestamp, IP, device, channel, result, related entity,
 * acting moderator if any) to satisfy an audit. CSV export at the
 * top right packages whatever the current filter shows.
 */

const CATEGORY_LABEL: Record<UserActivityCategory, string> = {
  auth:       'Autenticação',
  session:    'Sessão',
  profile:    'Perfil',
  content:    'Conteúdo',
  streaming:  'Streaming',
  moderation: 'Moderação',
  settings:   'Configurações',
  compliance: 'Compliance',
};

const CATEGORY_TONE: Record<UserActivityCategory, 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger'> = {
  auth:       'info',
  session:    'neutral',
  profile:    'brand',
  content:    'brand',
  streaming:  'success',
  moderation: 'danger',
  settings:   'neutral',
  compliance: 'warning',
};

const CATEGORY_ICON: Record<UserActivityCategory, React.ComponentType<{ size?: number }>> = {
  auth:       IconKey,
  session:    IconCalendar,
  profile:    IconUsers,
  content:    IconFeed,
  streaming:  IconMusic,
  moderation: IconShield,
  settings:   IconSettings,
  compliance: IconShield,
};

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Todas as categorias' },
  ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
];

const RESULT_OPTIONS = [
  { value: 'all',     label: 'Todos os resultados' },
  { value: 'success', label: 'Sucesso' },
  { value: 'failure', label: 'Falha' },
  { value: 'pending', label: 'Pendente' },
];

export default function UserActivitiesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { push } = useToast();

  const user = useMemo(
    () => MOCK_USERS.find((u) => u.id === params.id) ?? null,
    [params.id],
  );

  // Live audit feed — `usersService.activities()` hits the real
  // `/api/admin/users/:id/activities` endpoint when the admin is
  // pointed at a backend (NEXT_PUBLIC_API_BASE_URL set), and the
  // service throws otherwise. We fall back to the deterministic
  // mock generator on any failure so the page stays usable for
  // designers running the admin standalone OR before the API is
  // reachable, AND we surface the real events the moment the
  // backend responds. Per product feedback "No perfil de cada
  // usuário, inclua o registro de músicas que ele reproduziu na
  // plataforma e salve no admin junto das atividades do usuário."
  const [allEvents, setAllEvents] = useState<UserActivityEvent[]>([]);
  useEffect(() => {
    if (!user) {
      setAllEvents([]);
      return;
    }
    let cancelled = false;
    // Optimistic mock first so the table is never empty while the
    // network call is in flight.
    const seeded = generateUserActivities({
      user,
      count: 200,
      daysBack: 90,
    });
    setAllEvents(seeded);
    usersService
      .activities(user.id)
      .then((res) => {
        if (cancelled) return;
        if (res && Array.isArray(res.events) && res.events.length > 0) {
          setAllEvents(res.events);
        }
      })
      .catch((err) => {
        // Real endpoint isn't reachable yet (or returned an
        // error). Keep the mock so the audit table stays
        // populated for the team viewing this page.
        console.warn('admin activities fetch failed, using mock:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const summary = useMemo(() => summarizeActivities(allEvents), [allEvents]);

  /* ── Filters ──────────────────────────────────────────── */
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<UserActivityCategory | 'all'>('all');
  const [result, setResult] = useState<UserActivityResult | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allEvents.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (result !== 'all' && e.result !== result) return false;
      if (q) {
        const hay = [
          e.description,
          e.action,
          e.ip,
          e.userAgent,
          e.city,
          e.relatedEntity?.label,
          e.relatedEntity?.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allEvents, search, category, result]);

  /* ── Row expansion (compliance metadata) ──────────────── */
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggleExpand = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  /* ── CSV export ──────────────────────────────────────── */
  const exportCsv = () => {
    if (!user) return;
    const rows = [
      [
        'timestamp', 'category', 'action', 'description', 'result',
        'ip', 'user_agent', 'channel', 'city', 'country',
        'related_type', 'related_id', 'related_label',
        'actor_role', 'actor_name', 'metadata',
      ],
      ...filtered.map((e) => [
        e.timestamp,
        e.category,
        e.action,
        e.description,
        e.result,
        e.ip ?? '',
        e.userAgent ?? '',
        e.channel ?? '',
        e.city ?? '',
        e.country ?? '',
        e.relatedEntity?.type ?? '',
        e.relatedEntity?.id ?? '',
        e.relatedEntity?.label ?? '',
        e.actor?.role ?? '',
        e.actor?.name ?? '',
        e.metadata ? JSON.stringify(e.metadata) : '',
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? '');
            // RFC 4180: escape quotes, wrap when needed.
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atividades-${user.handle || user.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    push({
      type: 'success',
      title: 'CSV exportado',
      description: `${filtered.length} eventos baixados.`,
    });
  };

  if (!user) {
    notFound();
  }

  /* ── Table columns ───────────────────────────────────── */
  const columns: Column<UserActivityEvent>[] = [
    {
      id: 'timestamp',
      header: 'Quando',
      sortKey: (e) => e.timestamp,
      cell: (e) => (
        <div className={styles.cellTime}>
          <span className={styles.cellTimeMain}>{formatDateTime(e.timestamp)}</span>
          <span className={styles.cellTimeRel}>{formatRelative(e.timestamp)}</span>
        </div>
      ),
      width: 180,
    },
    {
      id: 'category',
      header: 'Categoria',
      sortKey: (e) => e.category,
      cell: (e) => {
        const Icon = CATEGORY_ICON[e.category];
        return (
          <span className={styles.categoryCell}>
            <Icon size={12} />
            <Badge tone={CATEGORY_TONE[e.category]} size="sm">
              {CATEGORY_LABEL[e.category]}
            </Badge>
          </span>
        );
      },
      width: 170,
    },
    {
      id: 'action',
      header: 'O que aconteceu',
      sortKey: (e) => e.action,
      cell: (e) => (
        <div className={styles.cellAction}>
          <span className={styles.cellActionDesc}>{e.description}</span>
          <span className={styles.cellActionCode} title="Código da ação">
            {e.action}
          </span>
          {e.actor && e.actor.role !== 'self' && (
            <span className={styles.byOther}>
              executado por <strong>{e.actor.name}</strong>
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'result',
      header: 'Resultado',
      sortKey: (e) => e.result,
      cell: (e) => {
        if (e.result === 'success') {
          return (
            <span className={`${styles.resultPill} ${styles.resultOk}`}>
              <IconCheck size={11} /> Sucesso
            </span>
          );
        }
        if (e.result === 'failure') {
          return (
            <span className={`${styles.resultPill} ${styles.resultFail}`}>
              <IconX size={11} /> Falha
            </span>
          );
        }
        return (
          <span className={`${styles.resultPill} ${styles.resultPending}`}>
            Pendente
          </span>
        );
      },
      width: 130,
    },
    {
      id: 'location',
      header: 'Origem',
      sortKey: (e) => e.city ?? '',
      cell: (e) => (
        <div className={styles.cellLocation}>
          <span className={styles.cellLocationCity}>{e.city ?? '—'}</span>
          <code className={styles.cellLocationIp}>{e.ip ?? '—'}</code>
        </div>
      ),
      width: 200,
    },
    {
      id: 'device',
      header: 'Dispositivo',
      sortKey: (e) => e.userAgent ?? '',
      cell: (e) => (
        <div className={styles.cellDevice}>
          <span className={styles.cellDeviceAgent}>{e.userAgent ?? '—'}</span>
          {e.channel && (
            <span className={styles.cellDeviceChannel}>{e.channel.toUpperCase()}</span>
          )}
        </div>
      ),
      width: 200,
    },
    {
      id: 'related',
      header: 'Objeto',
      cell: (e) =>
        e.relatedEntity ? (
          <span className={styles.relatedPill}>
            <strong>{e.relatedEntity.type}</strong>
            <code>#{e.relatedEntity.id.slice(0, 8)}</code>
            {e.relatedEntity.label && <span>{e.relatedEntity.label}</span>}
          </span>
        ) : (
          <span className={styles.muted}>—</span>
        ),
      width: 240,
    },
    {
      id: 'expand',
      header: '',
      align: 'right',
      cell: (e) => {
        const hasDetail = e.metadata && Object.keys(e.metadata).length > 0;
        if (!hasDetail) return <span className={styles.muted}>—</span>;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleExpand(e.id)}
            aria-label="Ver detalhes"
            iconOnly
          >
            <IconChevronRight
              size={14}
              style={{
                transform: expanded === e.id ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 120ms',
              }}
            />
          </Button>
        );
      },
      width: 56,
    },
  ];

  const totalIncidents = summary.moderationIncidents + summary.failedLogins;

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<IconChevronLeft size={14} />}
          onClick={() => router.push('/users')}
          className={styles.backBtn}
        >
          Voltar para usuários
        </Button>

        <div className={styles.headerCard}>
          <Avatar name={user.name} src={user.avatar} size="lg" />
          <div className={styles.headerText}>
            <span className={styles.headerEyebrow}>Atividades de</span>
            <h1 className={styles.headerTitle}>{user.name}</h1>
            <span className={styles.headerSub}>
              {user.email} · {user.city}-{user.state}
            </span>
          </div>
          <Button
            variant="primary"
            size="md"
            leadingIcon={<IconDownload size={14} />}
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            Exportar CSV ({filtered.length})
          </Button>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Eventos totais"
          value={String(summary.total)}
          icon={<IconFeed size={14} />}
          trendLabel="Últimos 90 dias"
        />
        <StatCard
          label="Logins (30 dias)"
          value={String(summary.loginsLast30d)}
          icon={<IconKey size={14} />}
          trendLabel={summary.lastLogin ? `Último: ${formatRelative(summary.lastLogin)}` : 'Sem login recente'}
        />
        <StatCard
          label="IPs únicos"
          value={String(summary.uniqueIps)}
          icon={<IconShield size={14} />}
          trendLabel={`${summary.uniqueDevices} dispositivo(s)`}
        />
        <StatCard
          label="Incidentes"
          value={String(totalIncidents)}
          icon={<IconBan size={14} />}
          trendLabel={`${summary.moderationIncidents} moderação · ${summary.failedLogins} login`}
        />
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <Card className={styles.filters}>
        <Input
          inputSize="md"
          placeholder="Buscar por descrição, IP, dispositivo, cidade…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<IconSearch size={14} />}
        />
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as UserActivityCategory | 'all')}
          options={CATEGORY_OPTIONS}
        />
        <Select
          value={result}
          onChange={(e) => setResult(e.target.value as UserActivityResult | 'all')}
          options={RESULT_OPTIONS}
        />
      </Card>

      {/* ── Table ──────────────────────────────────────────── */}
      <Card className={styles.tableCard}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            Nenhum evento corresponde aos filtros aplicados.
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={filtered}
              rowId={(e) => e.id}
              pageSize={50}
            />
            {/* Expanded-row detail panel rendered separately so the
             *  shared Table component doesn't need to know about it.
             *  Only shows when a row with metadata is expanded. */}
            {expanded && (() => {
              const ev = filtered.find((e) => e.id === expanded);
              if (!ev) return null;
              return (
                <div className={styles.expandPanel}>
                  <div className={styles.expandHeader}>
                    <span>Detalhes do evento</span>
                    <button
                      type="button"
                      className={styles.closeExpand}
                      onClick={() => setExpanded(null)}
                      aria-label="Fechar"
                    >
                      <IconX size={12} />
                    </button>
                  </div>
                  <dl className={styles.metaList}>
                    <dt>ID do evento</dt>
                    <dd><code>{ev.id}</code></dd>
                    {Object.entries(ev.metadata ?? {}).map(([k, v]) => (
                      <span key={k} className={styles.metaItem}>
                        <dt>{k}</dt>
                        <dd>{String(v)}</dd>
                      </span>
                    ))}
                  </dl>
                </div>
              );
            })()}
          </>
        )}
      </Card>
    </div>
  );
}
