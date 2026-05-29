'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import FeedComposerDrawer from '@/components/admin/FeedComposerDrawer';
import { useRouter } from 'next/navigation';
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
  IconPlus,
  IconBell,
} from '@/components/icons';
import { feedService } from '@/services/feed';
import { resolveAssetUrl } from '@/lib/utils';
import type { FeedItem, FeedItemType } from '@/types';
import styles from './page.module.css';

/**
 * AGENDA — calendário editorial estilo iOS Calendar.app.
 *
 * 3 visualizações compartilham o mesmo dataset:
 *   - Mês   : grid 6×7 + painel inferior com eventos do dia selecionado
 *   - Semana: 7-day stripe com dia selecionado abrindo lista abaixo
 *   - Lista : agrupado por dia, ordem cronológica
 *
 * O DOM mostra posts agendados (status='scheduled', tempo
 * `scheduledAt`) + posts recém-publicados via o composer desta
 * página (status='published'). Posts publicados antigos NÃO
 * aparecem — o objetivo da Agenda é cobrir o pipeline FUTURO +
 * confirmar a ação imediata "Publicar agora" do operador. Per
 * product feedback "Isso deve ocorrer inclusive quando a opção
 * selecionada for 'Publicar agora'".
 *
 * Drawer de composição (FeedComposerDrawer) é o mesmo da página
 * /feed — abre em modo criar (botão "+ Nova publicação" na
 * toolbar do PageHeader) ou em modo editar (clique num card).
 *
 * Microinterações:
 *   - Segmented control com pílula que desliza entre opções
 *     (Mês/Semana/Lista) via transição CSS de left+width
 *   - Stagger fade-in nos cards (40ms/grupo + 30ms/card)
 *   - Today em magenta→indigo (gradient da marca)
 *   - Card barra-vertical accent à esquerda (3px) como iOS
 */

type ViewMode = 'month' | 'week' | 'list';

/* ── Helpers de data ─────────────────────────────────────── */

const WEEKDAYS_LONG = [
  'Domingo', 'Segunda', 'Terça', 'Quarta',
  'Quinta', 'Sexta', 'Sábado',
];
const WEEKDAYS_SHORT_3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_SHORT_1 = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3).toLowerCase());

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Retorna a data principal de exibição do post (scheduled prioriza
 *  scheduledAt; publicado usa publishedAt). */
function postDateIso(p: FeedItem): string | null {
  if (p.status === 'scheduled' && p.scheduledAt) return p.scheduledAt;
  return p.publishedAt ?? p.scheduledAt;
}

/** Label do dia: "Hoje", "Amanhã", "Ontem", senão "12 de jun." */
function dayLabel(date: Date, today: Date): { big: string; weekday: string; isToday: boolean } {
  const weekday = WEEKDAYS_LONG[date.getDay()].toLowerCase();
  if (isSameDay(date, today)) return { big: 'Hoje', weekday, isToday: true };
  if (isSameDay(date, addDays(today, 1))) return { big: 'Amanhã', weekday, isToday: false };
  if (isSameDay(date, addDays(today, -1))) return { big: 'Ontem', weekday, isToday: false };
  return {
    big: `${date.getDate()} de ${MONTHS_SHORT[date.getMonth()]}.`,
    weekday,
    isToday: false,
  };
}

/** "em 3h", "agora", "há 1 dia". */
function timeRelative(iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
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

/* Comunicação por cor dos status — espelhada entre
 *   .cellEvent  (chips no calendário Mês)
 *   .cardAccent (barra vertical no PostCard)
 *   .statusPill (pill na linha de meta do PostCard)
 * pra que o operador identifique o status do post a partir da
 * cor independente de onde está olhando.
 *
 * Mapping:
 *   draft     → amber  (rascunho, ainda não foi pra fila)
 *   scheduled → magenta/indigo (cor da marca, no pipeline)
 *   published → green  (ao vivo no feed)
 *   inactive  → cinza  (soft-hide pelo admin)
 */
type StatusVisual = 'scheduled' | 'draft' | 'published' | 'inactive';
function statusVisual(status: FeedItem['status']): StatusVisual {
  if (status === 'draft') return 'draft';
  if (status === 'published') return 'published';
  if (status === 'inactive') return 'inactive';
  return 'scheduled';
}
function statusLabel(s: StatusVisual): string {
  switch (s) {
    case 'draft':     return 'rascunho';
    case 'published': return 'publicado';
    case 'inactive':  return 'inativo';
    default:          return 'agendado';
  }
}

function typeInfo(t: FeedItemType | null): { label: string; icon: React.ReactNode } {
  switch (t) {
    case 'image':         return { label: 'Imagem',      icon: <IconImage size={11} /> };
    case 'video':         return { label: 'Vídeo',       icon: <IconVideo size={11} /> };
    case 'youtube_video': return { label: 'YouTube',     icon: <IconVideo size={11} /> };
    case 'carousel':      return { label: 'Carrossel',   icon: <IconImage size={11} /> };
    case 'story':         return { label: 'Story',       icon: <IconFeed size={11} /> };
    case 'poll':          return { label: 'Enquete',     icon: <IconCheckCircle size={11} /> };
    case 'sponsored':     return { label: 'Patrocinado', icon: <IconStar size={11} /> };
    case 'broadcast':     return { label: 'Transmissão', icon: <IconEye size={11} /> };
    default:              return { label: 'Post',        icon: <IconFeed size={11} /> };
  }
}

/* ── Página ──────────────────────────────────────────────── */

export default function AdminAgendaPage() {
  const { push } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [editingPost, setEditingPost] = useState<FeedItem | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  /* Chooser de "criar algo neste dia" — aparece quando o usuário
   * clica no botão "+" que surge no hover de uma célula. Estado
   * = data alvo (a UI infere "abrir"). */
  const [chooserDay, setChooserDay] = useState<Date | null>(null);

  // `now` re-renderiza a cada 30s pra labels relativos ("em 3h")
  // não congelarem se a aba ficar aberta.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* ── Fetch ──────────────────────────────────────────── */

  const refetch = useCallback(async () => {
    try {
      const res = await feedService.list({ status: 'scheduled', limit: 200 });
      const sorted = [...res.items].sort((a, b) => {
        const aT = postDateIso(a) ? new Date(postDateIso(a)!).getTime() : 0;
        const bT = postDateIso(b) ? new Date(postDateIso(b)!).getTime() : 0;
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

  /* ── Index por dia ──────────────────────────────────── */

  const byDay = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    if (!items) return map;
    for (const p of items) {
      const iso = postDateIso(p);
      if (!iso) continue;
      const k = dayKey(new Date(iso));
      const arr = map.get(k);
      if (arr) arr.push(p);
      else map.set(k, [p]);
    }
    return map;
  }, [items]);

  /* ── Actions ────────────────────────────────────────── */

  const openCreate = useCallback(() => {
    setEditingPost(null);
    setComposerOpen(true);
  }, []);

  const openDetail = useCallback((post: FeedItem) => {
    setEditingPost(post);
    setComposerOpen(true);
  }, []);

  const onSaved = useCallback((post: FeedItem) => {
    /* Merge optimista: posts novos vão pra lista local
     * imediatamente, posts editados são substituídos. Inclui
     * status='published' (quando o usuário escolheu "Publicar
     * agora") — o operador vê o registro aparecer na agenda no
     * dia/hora em que o post está, confirmando a ação. */
    setItems((prev) => {
      const base = prev ? prev.filter((p) => p.id !== post.id) : [];
      // Aceita scheduled SEMPRE; aceita published só se for de
      // hoje ou futuro (não puxar histórico antigo de publicações
      // pra Agenda).
      const acceptable =
        post.status === 'scheduled' ||
        (post.status === 'published' &&
          !!post.publishedAt &&
          new Date(post.publishedAt).getTime() >= startOfDay(new Date()).getTime());
      const next = acceptable ? [...base, post] : base;
      next.sort((a, b) => {
        const aT = postDateIso(a) ? new Date(postDateIso(a)!).getTime() : 0;
        const bT = postDateIso(b) ? new Date(postDateIso(b)!).getTime() : 0;
        return aT - bT;
      });
      return next;
    });
    push({
      type: 'success',
      title:
        post.status === 'scheduled'
          ? 'Agendamento salvo'
          : 'Publicação ao ar',
      description: post.title?.trim() || 'Post salvo com sucesso.',
    });

    // Pula a navegação pro dia do post recém-criado/editado pra
    // ele aparecer destacado nos modos Mês/Semana.
    const iso = postDateIso(post);
    if (iso) {
      const target = startOfDay(new Date(iso));
      setSelectedDay(target);
      setCursor(target);
    }
  }, [push]);

  const goToday = useCallback(() => {
    const today = startOfDay(new Date());
    setCursor(today);
    setSelectedDay(today);
  }, []);

  /* ── Chooser de "criar algo neste dia" ────────────────── */

  const openChooser = useCallback((date: Date) => {
    setChooserDay(startOfDay(date));
  }, []);
  const closeChooser = useCallback(() => setChooserDay(null), []);

  const chooseCreatePost = useCallback(() => {
    setChooserDay(null);
    setEditingPost(null);
    setComposerOpen(true);
  }, []);
  const chooseCreateNotification = useCallback(() => {
    setChooserDay(null);
    /* Sem suporte ainda de prefill de data no editor de
     * notificações — leva o operador pra lista de notificações
     * pra criar a partir de lá. Quando o editor aceitar `?date=`,
     * passamos via query. */
    router.push('/notificacoes');
  }, [router]);

  // Esc fecha o chooser.
  useEffect(() => {
    if (!chooserDay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeChooser();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [chooserDay, closeChooser]);

  /* ── Navegação de período ───────────────────────────── */

  const navPrev = useCallback(() => {
    setCursor((c) => {
      const next = new Date(c);
      if (view === 'month') next.setMonth(next.getMonth() - 1);
      else if (view === 'week') next.setDate(next.getDate() - 7);
      else next.setDate(next.getDate() - 14);
      return next;
    });
  }, [view]);

  const navNext = useCallback(() => {
    setCursor((c) => {
      const next = new Date(c);
      if (view === 'month') next.setMonth(next.getMonth() + 1);
      else if (view === 'week') next.setDate(next.getDate() + 7);
      else next.setDate(next.getDate() + 14);
      return next;
    });
  }, [view]);

  /* ── Label do período + cálculo da pílula do segmented ─ */

  const periodLabel = useMemo(() => {
    if (view === 'month') {
      return `${MONTHS_LONG[cursor.getMonth()]} ${cursor.getFullYear()}`;
    }
    if (view === 'week') {
      const week = weekRange(cursor);
      const sameMonth = week.start.getMonth() === week.end.getMonth();
      const dStart = week.start.getDate();
      const dEnd = week.end.getDate();
      const mStart = MONTHS_SHORT[week.start.getMonth()];
      const mEnd = MONTHS_SHORT[week.end.getMonth()];
      return sameMonth
        ? `${dStart} – ${dEnd} ${mStart}.`
        : `${dStart} ${mStart}. – ${dEnd} ${mEnd}.`;
    }
    return 'Lista';
  }, [view, cursor]);

  // Calcula posição/largura do underline indicator das tabs com
  // base no botão ativo. useRef pra medir, useState pra triggar
  // re-render quando view muda. Mesmo padrão do segmented que tinha
  // antes, só que aplicado a tabs (com underline em vez de pílula).
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);
  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLButtonElement>(`button[data-active="true"]`);
    if (!active) return;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setIndicator({
      x: activeRect.left - containerRect.left,
      w: activeRect.width,
    });
  }, [view]);

  const today = startOfDay(now);

  /* ── Render ─────────────────────────────────────────── */

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Calendário editorial — publicações agendadas e recém-publicadas."
        actions={
          <Button variant="primary" onClick={openCreate}>
            <IconPlus size={14} />
            Nova publicação
          </Button>
        }
      />

      <div className={styles.root}>
        {/* Toolbar — duas linhas centralizadas:
         *   1) [◀ Período corrente ▶] [Hoje]
         *   2) [Mês] [Semana] [Lista]  ← tabs com underline */}
        <div className={styles.toolbar}>
          <div className={styles.periodRow}>
            {/* Spacer invisível na coluna 1 do grid — ocupa o
             *  mesmo track-size que o "Hoje" pra centralizar
             *  matematicamente o nav group no meio. */}
            <span aria-hidden="true" />
            <div className={styles.periodNavGroup}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={navPrev}
                aria-label="Período anterior"
              >
                <IconChevronLeft size={16} />
              </button>
              <span className={styles.periodLabel}>{periodLabel}</span>
              <button
                type="button"
                className={styles.navBtn}
                onClick={navNext}
                aria-label="Próximo período"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
            <button
              type="button"
              className={styles.todayBtn}
              onClick={goToday}
            >
              Hoje
            </button>
          </div>

          <div
            ref={tabsRef}
            className={styles.tabs}
            role="tablist"
            aria-label="Visualização"
            style={
              indicator
                ? ({
                    '--tab-x': `${indicator.x}px`,
                    '--tab-w': `${indicator.w}px`,
                  } as React.CSSProperties)
                : undefined
            }
          >
            {(['month', 'week', 'list'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                data-active={view === v}
                aria-selected={view === v}
                className={`${styles.tab} ${view === v ? styles.tabActive : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Lista'}
              </button>
            ))}
            <span className={styles.tabsIndicator} aria-hidden="true" />
          </div>

          {/* Legenda de cores — referência rápida pra status dos
           *  itens no calendário e na lista. */}
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendDotDraft}`} />
              Rascunho
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendDotScheduled}`} />
              Agendado
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendDotPublished}`} />
              Publicado
            </span>
          </div>
        </div>

        {/* Conteúdo */}
        {items === null ? (
          <div className={styles.skeleton} aria-busy="true">
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<IconCalendar size={28} />}
            title="Nada agendado por enquanto"
            description="Quando você agendar ou publicar um post, ele aparece aqui."
            actions={
              <Button variant="primary" onClick={openCreate}>
                <IconPlus size={14} />
                Nova publicação
              </Button>
            }
          />
        ) : (
          <div className={styles.surface} key={view}>
            {view === 'month' && (
              <MonthView
                cursor={cursor}
                today={today}
                selectedDay={selectedDay}
                byDay={byDay}
                now={now}
                onSelectDay={setSelectedDay}
                onPickPost={openDetail}
                onCreateForDay={openChooser}
              />
            )}
            {view === 'week' && (
              <WeekView
                cursor={cursor}
                today={today}
                selectedDay={selectedDay}
                byDay={byDay}
                now={now}
                onSelectDay={setSelectedDay}
                onPickPost={openDetail}
              />
            )}
            {view === 'list' && (
              <ListView
                items={items}
                today={today}
                now={now}
                onPickPost={openDetail}
              />
            )}
          </div>
        )}
      </div>

      {/* Chooser de "criar algo neste dia" — aparece quando o
       *  usuário clica no botão "+" que surge no hover de uma
       *  célula do mês. Dois caminhos de criação por enquanto:
       *  publicação no feed (abre o composer) e notificação
       *  (navega pra /notificacoes pra criar lá). */}
      {chooserDay && (
        <div
          className={styles.chooserScrim}
          onClick={closeChooser}
          role="presentation"
        >
          <div
            className={styles.chooserCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Criar algo neste dia"
          >
            <div className={styles.chooserHeader}>
              <span className={styles.chooserTitle}>Criar em</span>
              <span className={styles.chooserSub}>
                {(() => {
                  const lbl = dayLabel(chooserDay, today);
                  return lbl.isToday ? 'hoje' : lbl.big.toLowerCase();
                })()} · {WEEKDAYS_LONG[chooserDay.getDay()].toLowerCase()}
              </span>
            </div>
            <div className={styles.chooserOptions}>
              <button
                type="button"
                className={styles.chooserOpt}
                onClick={chooseCreatePost}
              >
                <span className={styles.chooserOptIcon}>
                  <IconFeed size={18} />
                </span>
                <span className={styles.chooserOptBody}>
                  <span className={styles.chooserOptTitle}>Publicação no feed</span>
                  <span className={styles.chooserOptDesc}>
                    Foto, vídeo, story, enquete ou YouTube — agendado para este dia.
                  </span>
                </span>
                <span className={styles.chooserOptArrow}>
                  <IconChevronRight size={16} />
                </span>
              </button>

              <button
                type="button"
                className={styles.chooserOpt}
                onClick={chooseCreateNotification}
              >
                <span className={styles.chooserOptIcon}>
                  <IconBell size={18} />
                </span>
                <span className={styles.chooserOptBody}>
                  <span className={styles.chooserOptTitle}>Notificação</span>
                  <span className={styles.chooserOptDesc}>
                    Envio em massa ou push pro app — abre o editor de notificações.
                  </span>
                </span>
                <span className={styles.chooserOptArrow}>
                  <IconChevronRight size={16} />
                </span>
              </button>
            </div>

            <button
              type="button"
              className={styles.chooserCancel}
              onClick={closeChooser}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <FeedComposerDrawer
        open={composerOpen}
        post={editingPost}
        onClose={() => setComposerOpen(false)}
        onSaved={onSaved}
      />
    </>
  );
}

/* ── Sub-componentes ─────────────────────────────────────── */

interface MonthViewProps {
  cursor: Date;
  today: Date;
  selectedDay: Date;
  byDay: Map<string, FeedItem[]>;
  now: Date;
  onSelectDay: (d: Date) => void;
  onPickPost: (p: FeedItem) => void;
  /** Disparado quando o usuário clica no botão "+" que aparece no
   *  hover de uma célula in-month. Abre o chooser de criação. */
  onCreateForDay: (date: Date) => void;
}
function MonthView({
  cursor,
  today,
  selectedDay,
  byDay,
  now,
  onSelectDay,
  onPickPost,
  onCreateForDay,
}: MonthViewProps) {
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(start, i);
      return { date: d, inMonth: d.getMonth() === month };
    });
  }, [cursor]);

  const selectedItems = byDay.get(dayKey(selectedDay)) ?? [];
  const sl = dayLabel(selectedDay, today);

  return (
    <div className={styles.monthWrap}>
      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS_SHORT_1.map((w, i) => (
          <span key={i} className={styles.weekday}>{w}</span>
        ))}
      </div>
      <div className={styles.monthGrid} role="grid">
        {cells.map(({ date, inMonth }, i) => {
          const k = dayKey(date);
          const posts = byDay.get(k) ?? [];
          const isToday = isSameDay(date, today);
          const isSelected = isSameDay(date, selectedDay);
          /* Até 3 mini-chips dentro da célula; o resto vira "+N
           * mais" no rodapé. Ler todos não cabe em ~70px de altura
           * abaixo da data — usuário precisaria abrir o painel
           * inferior pra ver detalhe. */
          const visible = posts.slice(0, 3);
          const overflow = posts.length - visible.length;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={[
                styles.cell,
                !inMonth && styles.cellOut,
                isToday && styles.cellToday,
                isSelected && styles.cellSelected,
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDay(date)}
              aria-label={`${date.getDate()} de ${MONTHS_LONG[date.getMonth()].toLowerCase()}${posts.length ? ` — ${posts.length} publicações` : ''}`}
            >
              <span className={styles.cellDay}>{date.getDate()}</span>

              {/* Lista de eventos dentro do card do dia. Cada chip
               *  é clicável (via span role=button + stopPropagation
               *  pra não disparar o onSelectDay do parent button).
               *  Foco/teclado: tabIndex={-1} pra ficar fora do tab
               *  flow — o usuário tab-eia entre células, depois
               *  abre o painel inferior pra navegar nos eventos
               *  com leitor de tela / teclado. */}
              {visible.length > 0 && (
                <span className={styles.cellEvents}>
                  {visible.map((p) => {
                    const iso = postDateIso(p);
                    const isPast = iso ? new Date(iso).getTime() < now.getTime() : false;
                    const sv = statusVisual(p.status);
                    /* Cor do chip = cor do status quando NÃO está no
                     * passado. Past tem precedência visual (cinza)
                     * porque indica "isso já aconteceu" — sobrescreve
                     * a paleta de status. */
                    const statusClass = isPast
                      ? styles.cellEventPast
                      : sv === 'draft'
                        ? styles.cellEventDraft
                        : sv === 'published'
                          ? styles.cellEventPublished
                          : sv === 'inactive'
                            ? styles.cellEventPast
                            : '';
                    return (
                      <span
                        key={p.id}
                        className={`${styles.cellEvent} ${statusClass}`}
                        role="button"
                        tabIndex={-1}
                        aria-label={`${statusLabel(sv)}: ${p.title?.trim() || 'publicação'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPickPost(p);
                        }}
                      >
                        <span className={styles.cellEventTime}>
                          {iso ? hhmm(iso) : ''}
                        </span>
                        <span className={styles.cellEventTitle}>
                          {p.title?.trim() || '(sem título)'}
                        </span>
                      </span>
                    );
                  })}
                  {overflow > 0 && (
                    <span className={styles.cellEventMore}>+{overflow} mais</span>
                  )}
                </span>
              )}

              {inMonth && (
                /* "+" no canto superior direito visível só no hover
                 *  da célula. Renderizado como span (não button) pra
                 *  não aninhar button dentro de button (HTML inválido).
                 *  role+tabIndex+onKeyDown dão acessibilidade
                 *  equivalente. stopPropagation impede o onClick
                 *  da célula de também rodar (que selecionaria o
                 *  dia). */
                <span
                  className={styles.cellPlusBtn}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Criar algo em ${date.getDate()} de ${MONTHS_LONG[date.getMonth()].toLowerCase()}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateForDay(date);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onCreateForDay(date);
                    }
                  }}
                >
                  <IconPlus size={14} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Painel do dia selecionado — eventos abaixo do grid. */}
      <div className={styles.dayPanel}>
        <div className={styles.dayPanelHeader}>
          <span className={`${styles.dayPanelTitle} ${sl.isToday ? styles.dayBigToday : ''}`}>
            {sl.big}
          </span>
          <span className={styles.dayPanelSub}>· {sl.weekday}</span>
        </div>
        {selectedItems.length === 0 ? (
          <div className={styles.dayPanelEmpty}>Nenhuma publicação neste dia.</div>
        ) : (
          selectedItems.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              now={now}
              animDelay={i * 30}
              onClick={() => onPickPost(p)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface WeekViewProps {
  cursor: Date;
  today: Date;
  selectedDay: Date;
  byDay: Map<string, FeedItem[]>;
  now: Date;
  onSelectDay: (d: Date) => void;
  onPickPost: (p: FeedItem) => void;
}
function WeekView({ cursor, today, selectedDay, byDay, now, onSelectDay, onPickPost }: WeekViewProps) {
  const week = useMemo(() => weekRange(cursor), [cursor]);
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  }, [week]);

  const selectedItems = byDay.get(dayKey(selectedDay)) ?? [];
  const sl = dayLabel(selectedDay, today);

  return (
    <div className={styles.weekWrap}>
      <div className={styles.weekHeader}>
        {days.map((d, i) => {
          const k = dayKey(d);
          const posts = byDay.get(k) ?? [];
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selectedDay);
          /* Mostra até 3 chips por coluna na Semana — depois disso
           * o usuário usa o painel inferior pra ver detalhe completo
           * do dia. Numero proporcional ao espaço vertical de 120px
           * que cada coluna ocupa. */
          const visible = posts.slice(0, 3);
          const overflow = posts.length - visible.length;
          return (
            <button
              key={i}
              type="button"
              className={[
                styles.weekDayCol,
                isSelected && styles.weekDayColSelected,
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDay(d)}
            >
              <div className={styles.weekDayHeader}>
                <span className={styles.weekDayLabel}>
                  {WEEKDAYS_SHORT_3[d.getDay()]}
                </span>
                {isToday ? (
                  /* Per product feedback "Remova a identificação 29
                   * na data de hoje, apenas coloque entre parenteses
                   * na frente (Hoje)". Hoje aparece como "(Hoje)"
                   * em gradient text — sem o pill mostrando o número
                   * "29". */
                  <span className={styles.weekDayToday}>(Hoje)</span>
                ) : (
                  <span className={styles.weekDayNum}>{d.getDate()}</span>
                )}
              </div>

              <span className={styles.weekDayEvents}>
                {visible.length === 0 ? (
                  <span className={styles.weekDayEmpty}>—</span>
                ) : (
                  <>
                    {visible.map((p) => {
                      const iso = postDateIso(p);
                      const isPast = iso ? new Date(iso).getTime() < now.getTime() : false;
                      const sv = statusVisual(p.status);
                      const statusClass = isPast
                        ? styles.cellEventPast
                        : sv === 'draft'
                          ? styles.cellEventDraft
                          : sv === 'published'
                            ? styles.cellEventPublished
                            : sv === 'inactive'
                              ? styles.cellEventPast
                              : '';
                      return (
                        <span
                          key={p.id}
                          className={`${styles.cellEvent} ${statusClass}`}
                          role="button"
                          tabIndex={-1}
                          aria-label={`${statusLabel(sv)}: ${p.title?.trim() || 'publicação'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPickPost(p);
                          }}
                        >
                          <span className={styles.cellEventTime}>
                            {iso ? hhmm(iso) : ''}
                          </span>
                          <span className={styles.cellEventTitle}>
                            {p.title?.trim() || '(sem título)'}
                          </span>
                        </span>
                      );
                    })}
                    {overflow > 0 && (
                      <span className={styles.cellEventMore}>+{overflow} mais</span>
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.dayPanel}>
        <div className={styles.dayPanelHeader}>
          <span className={`${styles.dayPanelTitle} ${sl.isToday ? styles.dayBigToday : ''}`}>
            {sl.big}
          </span>
          <span className={styles.dayPanelSub}>· {sl.weekday}</span>
        </div>
        {selectedItems.length === 0 ? (
          <div className={styles.dayPanelEmpty}>Nenhuma publicação neste dia.</div>
        ) : (
          selectedItems.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              now={now}
              animDelay={i * 30}
              onClick={() => onPickPost(p)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ListViewProps {
  items: FeedItem[];
  today: Date;
  now: Date;
  onPickPost: (p: FeedItem) => void;
}
function ListView({ items, today, now, onPickPost }: ListViewProps) {
  const groups = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    for (const p of items) {
      const iso = postDateIso(p);
      if (!iso) continue;
      const k = dayKey(new Date(iso));
      const arr = map.get(k);
      if (arr) arr.push(p);
      else map.set(k, [p]);
    }
    return Array.from(map.entries())
      .map(([key, arr]) => ({
        key,
        date: new Date(postDateIso(arr[0])!),
        items: arr,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [items]);

  return (
    <div className={styles.list}>
      {groups.map((g, gi) => {
        const lbl = dayLabel(g.date, today);
        return (
          <div
            key={g.key}
            className={styles.day}
            style={{ animationDelay: `${gi * 40}ms` }}
          >
            <div className={styles.dayHeader}>
              <span className={`${styles.dayBig} ${lbl.isToday ? styles.dayBigToday : ''}`}>
                {lbl.big}
              </span>
              <span className={styles.dayWeekday}>· {lbl.weekday}</span>
              <span className={styles.dayCount}>
                {g.items.length} {g.items.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            {g.items.map((p, idx) => (
              <PostCard
                key={p.id}
                post={p}
                now={now}
                animDelay={gi * 40 + idx * 30}
                onClick={() => onPickPost(p)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── PostCard compartilhado ─────────────────────────────── */

interface PostCardProps {
  post: FeedItem;
  now: Date;
  animDelay: number;
  onClick: () => void;
}
function PostCard({ post, now, animDelay, onClick }: PostCardProps) {
  const t = typeInfo(post.type);
  const iso = postDateIso(post);
  const sv = statusVisual(post.status);
  const cover = post.media.find((m) => m.kind !== 'youtube')?.url ?? null;
  const yt = post.media.find((m) => m.kind === 'youtube');
  const thumbSrc = cover ? resolveAssetUrl(cover) : null;
  const author =
    post.author?.name?.trim() ||
    post.author?.email?.split('@')[0] ||
    'Sem autor';

  /* Accent vertical + pill seguem o status visual — paleta
   * espelhada com os chips do calendário Mês. */
  const accentClass =
    sv === 'draft'
      ? styles.cardAccentDraft
      : sv === 'published'
        ? styles.cardAccentPublished
        : sv === 'inactive'
          ? styles.cardAccentInactive
          : '';
  const pillClass =
    sv === 'draft'
      ? styles.statusPillDraft
      : sv === 'published'
        ? styles.statusPillPublished
        : sv === 'inactive'
          ? styles.statusPillInactive
          : styles.statusPillScheduled;

  return (
    <button
      type="button"
      className={styles.card}
      style={{ animationDelay: `${animDelay}ms` }}
      onClick={onClick}
      aria-label={`Abrir detalhe de ${post.title || 'publicação'}`}
    >
      <span
        className={`${styles.cardAccent} ${accentClass}`}
        aria-hidden="true"
      />
      <div className={styles.time}>
        <span className={styles.timeBig}>{iso ? hhmm(iso) : '—'}</span>
        <span className={styles.timeRel}>
          {iso ? timeRelative(iso, now) : ''}
        </span>
      </div>

      <div className={styles.thumb}>
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbSrc} alt="" />
        ) : yt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/icon-youtube.svg" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
        ) : (
          t.icon
        )}
      </div>

      <div className={styles.body}>
        <span className={styles.cardTitle}>
          {post.title?.trim() || '(sem título)'}
        </span>
        <span className={styles.cardMeta}>
          <span className={`${styles.statusPill} ${pillClass}`}>
            {statusLabel(sv)}
          </span>
          <span className={styles.metaSep} aria-hidden="true" />
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
  );
}

/* ── Util: range da semana que contém uma data (domingo→sábado) ── */

function weekRange(d: Date): { start: Date; end: Date } {
  const start = startOfDay(d);
  start.setDate(start.getDate() - start.getDay());
  const end = addDays(start, 6);
  return { start, end };
}
