'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import FeedComposerDrawer from '@/components/admin/FeedComposerDrawer';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconImage,
  IconVideo,
  IconFeed,
  IconStar,
  IconEye,
  IconCheckCircle,
} from '@/components/icons';
import { feedService } from '@/services/feed';
import { resolveAssetUrl } from '@/lib/utils';
import type { FeedItem, FeedItemType } from '@/types';
import styles from './page.module.css';

/**
 * AGENDA — vista temporal dos posts agendados (status === 'scheduled')
 * no feed do app.
 *
 * Existe pra dar ao operador de conteúdo uma visão "calendário" do
 * pipeline editorial — algo que a lista CRUD do /feed não entrega
 * bem porque mistura todos os status (publicado, agendado, rascunho,
 * inativo) numa tabela só.
 *
 * Duas visualizações:
 *   - "Próximos" (default): lista agrupada por dia, ordem cronológica,
 *     headers sticky no scroll. Cada item mostra hora · thumb · tipo ·
 *     título · autor. Clique abre o FeedComposerDrawer em modo edição
 *     (mesmo drawer da página /feed — reaproveitado).
 *   - "Mês": calendário grid com dots indicando dias que têm posts
 *     agendados. Clicar num dia leva pra primeira publicação dele
 *     dentro da visualização Próximos.
 *
 * Microinterações no padrão da casa:
 *   - hover lift +1px + sombra ganhando profundidade
 *   - stagger fade-in dos cards no mount
 *   - chevron à direita translada +2px no hover
 *   - thumb cresce 4% no hover do card
 *   - badge "Próximo" sobre o primeiro item futuro com gradient
 *     magenta→indigo (mesma paleta do CTA Meu Fanverse)
 */

type ViewMode = 'list' | 'month';

/* ── Helpers ─────────────────────────────────────────────── */

const WEEKDAYS_LONG = [
  'Domingo', 'Segunda', 'Terça', 'Quarta',
  'Quinta', 'Sexta', 'Sábado',
];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Inicia o `Date` no início do dia local (00:00:00). */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** YYYY-MM-DD da data, pra usar como chave de agrupamento. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "14:30" */
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Hoje", "Amanhã", "Sex 14" — relativo à data corrente. */
function dayLabel(date: Date, today: Date): { big: string; weekday: string } {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(date, today)) {
    return {
      big: 'Hoje',
      weekday: WEEKDAYS_LONG[date.getDay()].toLowerCase(),
    };
  }
  if (isSameDay(date, tomorrow)) {
    return {
      big: 'Amanhã',
      weekday: WEEKDAYS_LONG[date.getDay()].toLowerCase(),
    };
  }
  // Default: "DD de Mês" + dia da semana
  const dd = date.getDate();
  const monthShort = MONTHS_LONG[date.getMonth()].slice(0, 3).toLowerCase();
  return {
    big: `${dd} de ${monthShort}.`,
    weekday: WEEKDAYS_LONG[date.getDay()].toLowerCase(),
  };
}

/**
 * Relativo "em 3h", "em 2 dias", "agora", "há 1h".
 * Usado pra dar contexto rápido sem o usuário precisar fazer matemática
 * mental olhando pra horários.
 */
function timeRelative(iso: string, now: Date): string {
  const target = new Date(iso).getTime();
  const diffMs = target - now.getTime();
  const absMin = Math.abs(diffMs) / 60_000;
  const isPast = diffMs < 0;

  if (absMin < 1) return 'agora';
  if (absMin < 60) {
    const m = Math.round(absMin);
    return isPast ? `há ${m}min` : `em ${m}min`;
  }
  if (absMin < 60 * 24) {
    const h = Math.round(absMin / 60);
    return isPast ? `há ${h}h` : `em ${h}h`;
  }
  const d = Math.round(absMin / 60 / 24);
  return isPast ? `há ${d} dias` : `em ${d} dias`;
}

/** Ícone + label do tipo do post. Mesma paleta visual do /feed. */
function typeInfo(t: FeedItemType | null): { label: string; icon: React.ReactNode } {
  switch (t) {
    case 'image':          return { label: 'Imagem',      icon: <IconImage size={11} /> };
    case 'video':          return { label: 'Vídeo',       icon: <IconVideo size={11} /> };
    case 'youtube_video':  return { label: 'YouTube',     icon: <IconVideo size={11} /> };
    case 'carousel':       return { label: 'Carrossel',   icon: <IconImage size={11} /> };
    case 'story':          return { label: 'Story',       icon: <IconFeed size={11} /> };
    case 'poll':           return { label: 'Enquete',     icon: <IconCheckCircle size={11} /> };
    case 'sponsored':      return { label: 'Patrocinado', icon: <IconStar size={11} /> };
    case 'broadcast':      return { label: 'Transmissão', icon: <IconEye size={11} /> };
    default:               return { label: 'Post',        icon: <IconFeed size={11} /> };
  }
}

/* ── Componente principal ────────────────────────────────── */

export default function AdminAgendaPage() {
  const { push } = useToast();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [calCursor, setCalCursor] = useState<Date>(() => startOfDay(new Date()));
  const [editingPost, setEditingPost] = useState<FeedItem | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  // `now` é fixo no mount + atualiza a cada 30s pra "em 3h" não
  // ficar estagnado se a aba ficar aberta. 30s é o sweet spot —
  // re-render barato, label não fica preso.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* ── Fetch ─────────────────────────────────────────── */

  const refetch = useCallback(async () => {
    try {
      // Limite generoso (200) pra cobrir 1-2 meses de agenda
      // mesmo em produção com cadência diária pesada. Se a
      // operação crescer muito, paginar por mês.
      const res = await feedService.list({ status: 'scheduled', limit: 200 });
      // Ordena cronologicamente — o backend pode não garantir
      // ordem específica em todos os filtros.
      const sorted = [...res.items].sort((a, b) => {
        const aT = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const bT = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return aT - bT;
      });
      setItems(sorted);
    } catch (err) {
      console.error('agenda list failed:', err);
      setItems([]);
      push({
        type: 'error',
        title: 'Falha ao carregar a agenda',
        description: 'Tente recarregar a página em instantes.',
      });
    }
  }, [push]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /* ── Derivados ─────────────────────────────────────── */

  const grouped = useMemo<{ key: string; date: Date; items: FeedItem[] }[]>(() => {
    if (!items) return [];
    const map = new Map<string, FeedItem[]>();
    for (const p of items) {
      if (!p.scheduledAt) continue;
      const k = dayKey(p.scheduledAt);
      const arr = map.get(k);
      if (arr) arr.push(p);
      else map.set(k, [p]);
    }
    return Array.from(map.entries())
      .map(([key, arr]) => ({
        key,
        date: new Date(arr[0].scheduledAt as string),
        items: arr,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [items]);

  // ID do "próximo" item — primeiro agendamento futuro a partir do
  // momento atual. Usado pra destacar o card com badge "Próximo".
  const nextId = useMemo<string | null>(() => {
    if (!items) return null;
    const future = items.find(
      (p) => p.scheduledAt && new Date(p.scheduledAt).getTime() >= now.getTime(),
    );
    return future?.id ?? null;
  }, [items, now]);

  // Stats no topo:
  //   - Total agendado
  //   - Próxima publicação (label relativo)
  //   - Esta semana (próximos 7 dias)
  const stats = useMemo(() => {
    if (!items) {
      return { total: 0, nextLabel: '—', week: 0 };
    }
    const total = items.length;
    const nextItem = items.find(
      (p) => p.scheduledAt && new Date(p.scheduledAt).getTime() >= now.getTime(),
    );
    const nextLabel = nextItem?.scheduledAt
      ? timeRelative(nextItem.scheduledAt, now)
      : '—';
    const weekEnd = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    const week = items.filter((p) => {
      if (!p.scheduledAt) return false;
      const t = new Date(p.scheduledAt).getTime();
      return t >= now.getTime() && t <= weekEnd;
    }).length;
    return { total, nextLabel, week };
  }, [items, now]);

  /* ── Actions ───────────────────────────────────────── */

  const openDetail = useCallback((post: FeedItem) => {
    setEditingPost(post);
    setComposerOpen(true);
  }, []);

  const onSaved = useCallback((post: FeedItem) => {
    // O composer pode editar título/data/status etc. Se o status
    // mudou de "scheduled" pra outra coisa, ele sai da agenda.
    setItems((prev) => {
      if (!prev) return prev;
      const filtered = prev.filter((p) => p.id !== post.id);
      if (post.status === 'scheduled') {
        // Re-inserir respeitando ordem cronológica.
        const next = [...filtered, post];
        next.sort((a, b) => {
          const aT = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
          const bT = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
          return aT - bT;
        });
        return next;
      }
      return filtered;
    });
    push({
      type: 'success',
      title: 'Agendamento atualizado',
      description: post.title || 'Publicação salva.',
    });
  }, [push]);

  /* ── Render: empty / loading / content ─────────────── */

  const today = startOfDay(now);

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Publicações agendadas no feed — visão temporal do pipeline editorial."
      />

      <div className={styles.root}>
        {/* Stats no topo */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total agendado</span>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statHint}>
              {stats.total === 1 ? 'publicação' : 'publicações'} em fila
            </span>
          </div>
          <div className={`${styles.stat} ${styles.statNext}`}>
            <span className={styles.statLabel}>Próxima publicação</span>
            <span className={styles.statValue}>{stats.nextLabel}</span>
            <span className={styles.statHint}>
              {nextId ? 'no topo da lista abaixo' : 'sem agendamentos futuros'}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Esta semana</span>
            <span className={styles.statValue}>{stats.week}</span>
            <span className={styles.statHint}>próximos 7 dias</span>
          </div>
        </div>

        {/* Toolbar de visualização */}
        <div className={styles.toolbar}>
          <div className={styles.viewToggle} role="tablist" aria-label="Visualização">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'list'}
              className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('list')}
            >
              Próximos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'month'}
              className={`${styles.viewBtn} ${view === 'month' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('month')}
            >
              Mês
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        {items === null ? (
          <div className={styles.skeleton} aria-busy="true" aria-label="Carregando agenda">
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<IconCalendar size={28} />}
            title="Nenhuma publicação agendada"
            description="Quando você agendar um post no feed, ele aparece aqui em ordem cronológica."
          />
        ) : view === 'list' ? (
          <AgendaList
            groups={grouped}
            today={today}
            now={now}
            nextId={nextId}
            onPickPost={openDetail}
          />
        ) : (
          <MonthCalendar
            cursor={calCursor}
            today={today}
            grouped={grouped}
            onCursorChange={setCalCursor}
            onPickPost={openDetail}
          />
        )}
      </div>

      {/* Composer drawer reaproveitado da página /feed — abre em modo
       *  edição quando o usuário clica num card. */}
      <FeedComposerDrawer
        open={composerOpen}
        post={editingPost}
        onClose={() => setComposerOpen(false)}
        onSaved={onSaved}
      />
    </>
  );
}

/* ── Sub-componente: lista agrupada por dia ──────────────── */

interface AgendaListProps {
  groups: { key: string; date: Date; items: FeedItem[] }[];
  today: Date;
  now: Date;
  nextId: string | null;
  onPickPost: (p: FeedItem) => void;
}

function AgendaList({ groups, today, now, nextId, onPickPost }: AgendaListProps) {
  return (
    <div className={styles.list}>
      {groups.map((g, gi) => {
        const label = dayLabel(g.date, today);
        return (
          <div
            key={g.key}
            className={styles.day}
            style={{ animationDelay: `${gi * 40}ms` }}
          >
            <div className={styles.dayHeader}>
              <span className={styles.dayBig}>{label.big}</span>
              <span className={styles.dayWeekday}>· {label.weekday}</span>
              <span className={styles.dayCount}>
                {g.items.length} {g.items.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            {g.items.map((p, idx) => {
              const t = typeInfo(p.type);
              const isNext = p.id === nextId;
              const cover = p.media.find((m) => m.kind !== 'youtube')?.url ?? null;
              const yt = p.media.find((m) => m.kind === 'youtube');
              const ytThumb = yt ? '/icon-youtube.svg' : null;
              const thumbSrc = cover ? resolveAssetUrl(cover) : null;
              const author = p.author?.name?.trim() || p.author?.email?.split('@')[0] || 'Sem autor';

              return (
                <div className={styles.cardWrap} key={p.id}>
                  <button
                    type="button"
                    className={`${styles.card} ${isNext ? styles.cardNext : ''}`}
                    style={{ animationDelay: `${gi * 40 + idx * 30}ms` }}
                    onClick={() => onPickPost(p)}
                    aria-label={`Abrir detalhe de ${p.title || 'publicação'}`}
                  >
                    <div className={styles.time}>
                      <span className={styles.timeBig}>
                        {p.scheduledAt ? hhmm(p.scheduledAt) : '—'}
                      </span>
                      <span className={styles.timeRel}>
                        {p.scheduledAt ? timeRelative(p.scheduledAt, now) : ''}
                      </span>
                    </div>

                    <div className={styles.thumb}>
                      {thumbSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbSrc} alt="" />
                      ) : ytThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ytThumb} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                      ) : (
                        t.icon
                      )}
                    </div>

                    <div className={styles.body}>
                      <span className={styles.cardTitle}>
                        {p.title?.trim() || '(sem título)'}
                      </span>
                      <span className={styles.cardMeta}>
                        <span className={styles.typePill}>
                          {t.icon}
                          {t.label}
                        </span>
                        <span className={styles.metaSep} aria-hidden="true" />
                        <span className={styles.cardAuthor} title={author}>
                          {author}
                        </span>
                      </span>
                    </div>

                    <span className={styles.chevron} aria-hidden="true">
                      <IconChevronRight size={16} />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ── Sub-componente: calendário mensal ──────────────────── */

interface MonthCalendarProps {
  cursor: Date;
  today: Date;
  grouped: { key: string; date: Date; items: FeedItem[] }[];
  onCursorChange: (next: Date) => void;
  onPickPost: (p: FeedItem) => void;
}

function MonthCalendar({
  cursor,
  today,
  grouped,
  onCursorChange,
  onPickPost,
}: MonthCalendarProps) {
  // Constrói o array de 42 células (6 linhas × 7 colunas) cobrindo
  // o mês visível. Dias do mês anterior/posterior aparecem
  // esmaecidos pra preencher o grid.
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDow = firstOfMonth.getDay(); // 0=Dom
    const start = new Date(year, month, 1 - startDow);
    const arr: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push({ date: d, inMonth: d.getMonth() === month });
    }
    return arr;
  }, [cursor]);

  // Mapa rápido dia → lista de posts agendados nesse dia.
  const byDay = useMemo(() => {
    const m = new Map<string, FeedItem[]>();
    for (const g of grouped) {
      m.set(g.key, g.items);
    }
    return m;
  }, [grouped]);

  const prevMonth = () => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() - 1);
    onCursorChange(next);
  };
  const nextMonth = () => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    onCursorChange(next);
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.calNav}>
        <button
          type="button"
          className={styles.calNavBtn}
          onClick={prevMonth}
          aria-label="Mês anterior"
        >
          <IconChevronLeft size={14} />
        </button>
        <span className={styles.calMonth}>
          {MONTHS_LONG[cursor.getMonth()]} {cursor.getFullYear()}
        </span>
        <button
          type="button"
          className={styles.calNavBtn}
          onClick={nextMonth}
          aria-label="Próximo mês"
        >
          <IconChevronRight size={14} />
        </button>
      </div>

      <div className={styles.calWeekdays} aria-hidden="true">
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w} className={styles.calWeekday}>{w}</span>
        ))}
      </div>

      <div className={styles.calGrid} role="grid">
        {cells.map(({ date, inMonth }, i) => {
          const k = dayKey(date.toISOString());
          const dayPosts = byDay.get(k) ?? [];
          const isToday = isSameDay(date, today);
          const visibleDots = dayPosts.slice(0, 4);
          const overflow = dayPosts.length - visibleDots.length;
          // Cell clicável só se tem posts; o callback abre o primeiro.
          const hasPosts = dayPosts.length > 0;
          return (
            <button
              type="button"
              key={i}
              className={[
                styles.calCell,
                !inMonth && styles.calCellOut,
                isToday && styles.calCellToday,
              ].filter(Boolean).join(' ')}
              onClick={() => hasPosts && onPickPost(dayPosts[0])}
              disabled={!inMonth || !hasPosts}
              aria-label={
                hasPosts
                  ? `${date.getDate()} de ${MONTHS_LONG[date.getMonth()].toLowerCase()} — ${dayPosts.length} publicações`
                  : `${date.getDate()} de ${MONTHS_LONG[date.getMonth()].toLowerCase()}`
              }
            >
              <span className={styles.calDay}>{date.getDate()}</span>
              {hasPosts && (
                <div className={styles.calDots}>
                  {visibleDots.map((p) => (
                    <span key={p.id} className={styles.calDot} aria-hidden="true" />
                  ))}
                  {overflow > 0 && (
                    <span className={styles.calMore}>+{overflow}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
