'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { IconBell, IconCheckCircle, IconBan, IconAlert } from '@/components/icons';
import {
  notificationsService,
  type NotificationItem,
  type NotificationChannel,
  type NotificationCategory,
  CATEGORY_LABEL,
  CHANNEL_LABEL,
} from '@/services/notifications';
import { formatNumber } from '@/lib/format';
import styles from './page.module.css';

/**
 * Notificações — visão geral do que a plataforma dispara (in-app
 * + email), com toggle por canal + master toggle por tipo.
 *
 * Lista agrupada por categoria (Ciclo de vida, Social, Conteúdo,
 * Engajamento). Cada row mostra trigger em linguagem natural,
 * badges (wired/planejado/sistema) e os toggles.
 */
export default function NotificacoesPage() {
  const { push } = useToast();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [saving, setSaving] = useState<Partial<Record<string, boolean>>>({});

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

  /* Agrupa por categoria preservando a ordem do catálogo. */
  const grouped = useMemo(() => {
    if (!items) return null;
    const order: NotificationCategory[] = [
      'lifecycle',
      'social',
      'content',
      'engagement',
    ];
    return order
      .map((cat) => ({
        category: cat,
        rows: items.filter((i) => i.category === cat),
      }))
      .filter((g) => g.rows.length > 0);
  }, [items]);

  const stats = useMemo(() => {
    if (!items) return null;
    const wired = items.filter((i) => i.wired).length;
    const active = items.filter((i) => i.wired && i.enabled).length;
    const planned = items.filter((i) => !i.wired).length;
    return { total: items.length, wired, active, planned };
  }, [items]);

  async function persist(item: NotificationItem, patch: Partial<NotificationItem>) {
    const next: NotificationItem = { ...item, ...patch };
    setItems((prev) =>
      prev ? prev.map((x) => (x.kind === item.kind ? next : x)) : prev,
    );
    setSaving((s) => ({ ...s, [item.kind]: true }));
    try {
      await notificationsService.upsert({
        kind: next.kind,
        enabled: next.enabled,
        channels: next.channels,
      });
    } catch (err) {
      // Rollback otimista
      setItems((prev) =>
        prev ? prev.map((x) => (x.kind === item.kind ? item : x)) : prev,
      );
      push({
        type: 'error',
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setSaving((s) => {
        const { [item.kind]: _, ...rest } = s;
        return rest;
      });
    }
  }

  function toggleEnabled(item: NotificationItem) {
    if (item.system) return;
    persist(item, { enabled: !item.enabled });
  }

  function toggleChannel(item: NotificationItem, channel: NotificationChannel) {
    if (item.system) return;
    const current = item.channels[channel] ?? item.defaultChannels.includes(channel);
    persist(item, {
      channels: { ...item.channels, [channel]: !current },
    });
  }

  return (
    <>
      <PageHeader
        title="Notificações"
        description="Catálogo de notificações que a plataforma dispara — no app e por email. Toggle por canal define se aquele tipo sai por aquele canal; o master toggle desliga o tipo de vez. Notificações de sistema (login etc.) não podem ser desativadas."
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

        {/* Grupos por categoria */}
        {items === null && (
          <Card>
            <div className={styles.loading}>Carregando…</div>
          </Card>
        )}

        {grouped?.map((group) => (
          <Card key={group.category}>
            <CardHeader title={CATEGORY_LABEL[group.category]} />
            <div className={styles.list}>
              {group.rows.map((row) => (
                <NotificationRow
                  key={row.kind}
                  item={row}
                  saving={!!saving[row.kind]}
                  onToggleEnabled={() => toggleEnabled(row)}
                  onToggleChannel={(ch) => toggleChannel(row, ch)}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/* ── Row ─────────────────────────────────────────────────────── */

interface NotificationRowProps {
  item: NotificationItem;
  saving: boolean;
  onToggleEnabled: () => void;
  onToggleChannel: (ch: NotificationChannel) => void;
}

function NotificationRow({
  item,
  saving,
  onToggleEnabled,
  onToggleChannel,
}: NotificationRowProps) {
  const isOn = item.enabled && !item.system; // sistema sempre on visual
  const masterChecked = item.system ? true : item.enabled;

  return (
    <div className={styles.row} data-disabled={!masterChecked}>
      <div className={styles.rowMain}>
        <div className={styles.rowHeader}>
          <h3 className={styles.rowTitle}>{item.label}</h3>
          <div className={styles.rowBadges}>
            <code className={styles.kindCode}>{item.kind}</code>
            {item.system ? (
              <Badge tone="warning" size="sm">Sistema</Badge>
            ) : item.wired ? (
              <Badge tone="success" size="sm" dot>Ativo</Badge>
            ) : (
              <Badge tone="neutral" size="sm">Planejado</Badge>
            )}
          </div>
        </div>
        <p className={styles.rowDescription}>{item.description}</p>
        <p className={styles.rowTrigger}>
          <span className={styles.triggerLabel}>Quando dispara: </span>
          {item.trigger}
        </p>
      </div>

      <div className={styles.rowControls}>
        {/* Toggle por canal */}
        <div className={styles.channels}>
          {item.supportedChannels.map((ch) => {
            const active =
              item.channels[ch] ?? item.defaultChannels.includes(ch);
            return (
              <button
                key={ch}
                type="button"
                className={styles.channelChip}
                data-active={active && masterChecked}
                disabled={item.system || saving || !masterChecked}
                onClick={() => onToggleChannel(ch)}
                title={
                  item.system
                    ? 'Canal de sistema — não pode ser desligado'
                    : !masterChecked
                      ? 'Ative o tipo primeiro pra ajustar canais'
                      : active
                        ? `Desligar ${CHANNEL_LABEL[ch]}`
                        : `Ligar ${CHANNEL_LABEL[ch]}`
                }
              >
                <span className={styles.channelDot} />
                {CHANNEL_LABEL[ch]}
              </button>
            );
          })}
        </div>

        {/* Master toggle */}
        <label
          className={styles.toggle}
          aria-label={masterChecked ? 'Desativar' : 'Ativar'}
          title={
            item.system
              ? 'Sistema — sempre ativo'
              : masterChecked
                ? 'Desativar'
                : 'Ativar'
          }
        >
          <input
            type="checkbox"
            checked={masterChecked}
            disabled={item.system || saving}
            onChange={onToggleEnabled}
          />
          <span className={styles.toggleTrack} aria-hidden="true">
            <span className={styles.toggleThumb} />
          </span>
        </label>
      </div>
      <span className={styles.hidden}>{isOn ? 'on' : 'off'}</span>
    </div>
  );
}
