'use client';

/**
 * RankingStoreModal — modal "Ranking completo + Loja" do Fanverse.
 *
 * Porte do wireframe standalone pra stack (React + CSS Modules).
 *
 * Dados REAIS já existentes na plataforma:
 *  - ranking (lista + pódio + minha posição): useRanking() — all-time,
 *    SUM(points) — com nome, avatar, cidade e Fanpoints reais.
 *  - saldo de Fanpoints (Loja) + Fanpoints do painel pessoal:
 *    useUserProfile(user.id).fanpoints.
 *  - usuário logado: useAuth().
 * Dados MOCK (gamificação ainda sem backend): tier/nível/sequência,
 * sparkline, conquistas/benefícios, missões e o catálogo da Loja
 * (produtos/experiências). O resgate só simula (toast). As tabs de
 * período são cosméticas por ora (só existe ranking all-time) — todas
 * mostram a mesma lista real.
 *
 * Abre via CustomEvent('app:open-ranking-store', { detail:{ screen }})
 * (mesmo padrão do FanpointsModal). Fecha por Esc, backdrop ou X.
 * Header = só o título; as tabs de período + intervalo e os atalhos
 * Loja/Presentes vivem numa toolbar no topo da área de conteúdo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import RankMedallion from './RankMedallion';
import { BeneficiosTab, currentTierForRank } from './FanpointsModal';
import styles from './RankingStoreModal.module.css';

type Screen = 'ranking' | 'loja';
type Tab = 'classificacao' | 'evolucao' | 'jornada' | 'loja';
type Period = 'diario' | 'semanal' | 'mensal' | 'anual';
type StoreTab = 'experiencias' | 'produtos';
type Sort = 'relevancia' | 'menor' | 'maior' | 'novidades';
type MissionTab = 'diaria' | 'semanal';

/* ── Catálogo da Loja (mock — sem backend ainda) ──────────────── */

interface StoreItem { name: string; cost: number; original?: number; discount?: string }

const PRODUCTS: StoreItem[] = [
  { name: 'Chapéu Ana Castela — Herança Couro Preto', cost: 24000, original: 28000, discount: '−14%' },
  { name: 'Vinil "Herança" Autografado', cost: 18000, original: 21000, discount: '−14%' },
  { name: 'Moletom Fire Arena', cost: 12000 },
  { name: 'Camiseta Boiadeira Oficial', cost: 6500, original: 7500, discount: '−13%' },
  { name: 'Caneca Boiadeira', cost: 2800 },
  { name: 'Violão Signature Ana Castela', cost: 89000 },
  { name: 'Boné Trucker Boiadeira', cost: 5200, original: 6000, discount: '−13%' },
  { name: 'Chinelo Slide Oficial', cost: 3900 },
  { name: 'Jaqueta Jeans Customizada', cost: 22000, original: 25000, discount: '−12%' },
  { name: 'Bota Country Edição Fã', cost: 31000 },
  { name: 'Pôster Autografado A1', cost: 4500 },
  { name: 'Necessaire Boiadeira', cost: 2600 },
  { name: 'Garrafa Térmica Inox', cost: 3400 },
  { name: 'Bandana Pack (3 un)', cost: 2900 },
  { name: 'Camisa Manga Longa UV', cost: 7800, original: 8900, discount: '−12%' },
  { name: 'Mochila Fire Arena', cost: 9600 },
  { name: 'Chaveiro Metal Coleção', cost: 1500 },
  { name: 'Almofada Boiadeira', cost: 3100 },
];

const EXPERIENCES: StoreItem[] = [
  { name: 'Meet & Greet VIP', cost: 65000 },
  { name: 'Soundcheck Exclusivo', cost: 48000 },
  { name: 'Ingresso Fire Arena — Pista Premium', cost: 38000 },
  { name: 'Videochamada de 3 min', cost: 80000 },
  { name: 'Acesso aos Bastidores', cost: 55000 },
  { name: 'Aula de Viola com a banda', cost: 42000 },
];

/* ── Gamificação ainda sem backend (mock) ─────────────────────── */

interface MissionDef {
  title: string; count: string; pct: string; metaLeft: string; reward: string;
  details: { label: string; done: boolean }[]; note: string;
}

const MISSIONS: Record<MissionTab, MissionDef> = {
  diaria: {
    title: 'Ouça 3 faixas da Ana hoje',
    count: '2/3', pct: '66%',
    metaLeft: 'Sequência: 7 dias → bônus +200 FP',
    reward: '+30 FP',
    details: [
      { label: 'Faixa 1 ouvida (stream válido)', done: true },
      { label: 'Faixa 2 ouvida (stream válido)', done: true },
      { label: 'Faixa 3 — em andamento', done: false },
    ],
    note: 'Stream válido conta com 80% da faixa ouvida · Reseta todo dia à meia-noite · Inicia na segunda.',
  },
  semanal: {
    title: 'Missão da semana',
    count: '2/4', pct: '50%',
    metaLeft: 'Inicia na quarta · reseta semanalmente',
    reward: '4 tarefas',
    details: [
      { label: 'Assistir 1 clipe oficial no YouTube até o fim', done: true },
      { label: 'Comentar em 2 posts/comunidades', done: true },
      { label: 'Convidar 1 amigo (conta quando ele ativar)', done: false },
      { label: 'Ouvir o lançamento/destaque da semana', done: false },
    ],
    note: 'Complete todas as tarefas para acelerar a subida de tier.',
  },
};

const BADGES = [
  { label: 'Top 1%', sub: 'Mês de maio' },
];

/* Sparklines mock POR PERÍODO — "Você" + 3 referências (Top 1/10/50).
 * Os traços do gráfico mudam ao alternar o período (diário/semanal/
 * mensal/anual). */
const K = (arr: number[]) => arr.map((x) => x * 1000);
interface SparkSet { me: number[]; top1: number[]; top10: number[]; top50: number[] }
const SPARKS: Record<Period, SparkSet> = {
  diario: {
    me:    K([0.4, 0.9, 1.4, 1.1, 2.0, 2.6, 3.1]),
    top1:  K([12, 18, 25, 33, 40, 47, 54]),
    top10: K([4, 6, 9, 12, 15, 18, 21]),
    top50: K([1, 1.6, 2.2, 2.8, 3.4, 4, 4.6]),
  },
  semanal: {
    me:    K([6.2, 9.1, 7.5, 12, 14.4, 11, 16.4]),
    top1:  K([120, 138, 150, 168, 182, 200, 218]),
    top10: K([40, 47, 52, 58, 64, 71, 80]),
    top50: K([12, 14, 15.5, 17, 19, 21, 24]),
  },
  mensal: {
    me:    K([20, 35, 48, 60, 76, 90, 110]),
    top1:  K([400, 520, 640, 760, 880, 1000, 1150]),
    top10: K([150, 200, 260, 320, 380, 440, 520]),
    top50: K([50, 70, 90, 110, 135, 160, 190]),
  },
  anual: {
    me:    K([120, 260, 410, 560, 720, 900, 1100]),
    top1:  K([2000, 3200, 4600, 6000, 7600, 9200, 11000]),
    top10: K([800, 1300, 1900, 2500, 3200, 4000, 4900]),
    top50: K([300, 520, 760, 1000, 1300, 1650, 2050]),
  },
};

/* Imagens do slider dos produtos (mock). Salve os arquivos em
 * public/store/ — fundo branco no slot, contain pra mostrar a peça
 * inteira. */
const PRODUCT_IMAGES = ['/store/produto-1.jpg', '/store/produto-2.jpg'];

/* Rótulo/intervalo cosmético por período (só ranking all-time existe). */
const PERIOD_META: Record<Period, { label: string; range: string }> = {
  diario:  { label: 'Hoje · 16 jun', range: 'Encerra em 13h 42min' },
  semanal: { label: '10 – 16 jun', range: 'Semana 24 · termina em 2d 6h' },
  mensal:  { label: 'Junho 2026', range: 'Termina em 14 dias' },
  anual:   { label: '2026', range: 'Temporada anual' },
};

/* Abas principais do modal. Ordem fixa pedida pelo produto. */
const MAIN_TABS: [Tab, string][] = [
  ['classificacao', 'Classificação'],
  ['evolucao', 'Minha evolução'],
  ['jornada', 'Jornada'],
  ['loja', 'Loja'],
];
const TAB_TITLE: Record<Tab, string> = {
  classificacao: 'Ranking Fanverse',
  evolucao: 'Minha Evolução',
  jornada: 'Sua Jornada',
  loja: 'Loja Fanverse',
};

/* Marcos do eixo X do gráfico (7 pontos) — dia / semana / mês conforme
 * o período. */
const CHART_X_LABELS: Record<Period, string[]> = {
  diario:  ['0h', '4h', '8h', '12h', '16h', '20h', '24h'],
  semanal: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
  mensal:  ['1', '5', '10', '15', '20', '25', '30'],
  anual:   ['Jan', 'Mar', 'Mai', 'Jul', 'Set', 'Nov', 'Dez'],
};
const CHART_X_TIP: Record<Period, string> = {
  diario: 'Hora do dia',
  semanal: 'Dia da semana',
  mensal: 'Dia do mês',
  anual: 'Mês do ano',
};

/* Fração do total de Fanpoints atribuída a cada período (mock) — o valor
 * do dia/semana/mês muda; o total (100%) fica embaixo. */
const PERIOD_FP_RATIO: Record<Period, number> = {
  diario: 0.03,
  semanal: 0.12,
  mensal: 0.45,
  anual: 0.8,
};
/* Rótulo da variação (esquerda do gráfico). */
const PERIOD_NAME: Record<Period, string> = {
  diario: 'Hoje',
  semanal: 'Esta semana',
  mensal: 'Este mês',
  anual: 'Este ano',
};
/* Rótulo curto pros badges discretos de filtro na Classificação. */
const PERIOD_BADGE: Record<Period, string> = {
  diario: 'Hoje',
  semanal: 'Semana',
  mensal: 'Mês',
  anual: 'Ano',
};

/* ── Helpers ──────────────────────────────────────────────────── */

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '·';

interface Row {
  rank: number; pts: number; you: boolean; name: string; city: string;
  avatarUrl: string | null; initials: string; points: string;
  ring: string; rankColor: string; delta: number;
}

/* Gera os paths de N séries numa escala Y compartilhada (pra as
 * linhas serem comparáveis no mesmo gráfico). Expõe também os pontos,
 * a escala (min/max/span) e o mapeador toY pra desenhar os eixos. */
const CHART_W = 300;
const CHART_H = 96;
function multiChartPaths(seriesList: number[][]) {
  const all = seriesList.flat();
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = (max - min) || 1;
  const toY = (v: number) => 90 - ((v - min) / span) * 66;
  const series = seriesList.map((spark) => {
    const n = spark.length;
    const pts = spark.map((v, i) => [(i / (n - 1)) * CHART_W, toY(v)] as const);
    const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = `${line} L${CHART_W},${CHART_H} L0,${CHART_H} Z`;
    const last = pts[pts.length - 1];
    return { line, area, cx: last[0].toFixed(1), cy: last[1].toFixed(1), pts };
  });
  return { series, min, max, span, toY };
}

/* Slider de imagens do produto (mock) — 2 fotos com dots pra trocar,
 * cross-fade, fundo branco. */
function ProductSlider({ discount }: { discount?: string }) {
  const [idx, setIdx] = useState(0);
  return (
    <div className={styles.productImg}>
      {discount && <span className={styles.discountTag}>{discount}</span>}
      {PRODUCT_IMAGES.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className={`${styles.productImgPhoto} ${i === idx ? styles.productImgActive : ''}`}
          draggable={false}
        />
      ))}
      <div className={styles.productDots}>
        {PRODUCT_IMAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.productDot} ${i === idx ? styles.productDotActive : ''}`}
            onClick={() => setIdx(i)}
            aria-label={`Imagem ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Component ────────────────────────────────────────────────── */

export default function RankingStoreModal() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<Tab>('classificacao');
  const [period, setPeriod] = useState<Period>('diario');
  const [storeTab, setStoreTab] = useState<StoreTab>('experiencias');
  const [sort, setSort] = useState<Sort>('relevancia');
  const [searchOpen, setSearchOpen] = useState(false);
  const [storeQuery, setStoreQuery] = useState('');
  const [rankSearchOpen, setRankSearchOpen] = useState(false);
  const [missionTab, setMissionTab] = useState<MissionTab>('diaria');
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [hoverPt, setHoverPt] = useState<number | null>(null);
  const [top3Open, setTop3Open] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const achRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  /* ── Dados reais ── */
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const { ranking, loading: rankingLoading } = useRanking(open);
  const saldoFP = profile?.fanpoints ?? 0;

  /* Abre via evento global (detail.screen opcional). */
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { screen?: Screen } | undefined;
      setTab(detail?.screen === 'loja' ? 'loja' : 'classificacao');
      setClosing(false);
      setOpen(true);
    };
    window.addEventListener('app:open-ranking-store', onOpen);
    return () => window.removeEventListener('app:open-ranking-store', onOpen);
  }, []);

  const close = useCallback(() => {
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 300);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  /* Conteúdo sempre começa no topo ao trocar de aba (sem "pulo"). */
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab]);

  const pm = PERIOD_META[period];

  /* Linhas reais do ranking (all-time). O período é cosmético por
   * enquanto — todas as abas mostram a mesma lista real. */
  const rows = useMemo<Row[]>(() => {
    return ranking.map((r, i) => {
      const rank = i + 1;
      const isMe = !!user?.id && r.userId === user.id;
      const baseName = r.name?.trim() || 'Fã';
      /* Variação de posição (mock determinístico — sem histórico real
       * ainda): >0 subiu, <0 desceu, 0 manteve. */
      const delta = ((rank * 7) % 9) - 4;
      /* Estilo padronizado com a aba Superfãs: #N cinza uniforme
       * (sem cor de medalha) — a colocação Top 10 é sinalizada pelo
       * selo (RankMedallion) no avatar. */
      return {
        rank,
        pts: r.points,
        you: isMe,
        name: isMe ? `Você · ${baseName}` : baseName,
        city: r.city ?? '',
        avatarUrl: r.avatarUrl ?? null,
        initials: initialsOf(baseName),
        points: `${fmt(r.points)} FP`,
        ring: isMe ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.12)',
        rankColor: isMe ? '#fff' : 'rgba(245,245,247,.55)',
        delta,
      };
    });
  }, [ranking, user?.id]);

  /* Top 3 em lista, igual aos demais (sem pódio) — a lista mostra
   * todas as colocações 1..N. */
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const meIndex = useMemo(() => rows.findIndex((r) => r.you), [rows]);
  const me = meIndex >= 0 ? rows[meIndex] : null;
  const myRank = meIndex >= 0 ? meIndex + 1 : null;
  const myPoints = me ? me.pts : saldoFP;
  /* FP do período selecionado (dia/semana/mês/ano) — muda por aba; o
   * total real fica embaixo. */
  const periodFP = Math.round(myPoints * PERIOD_FP_RATIO[period]);

  /* Colocação por intervalo (mock determinístico) — posição + variação
   * vs o mesmo período anterior (>0 subiu / <0 desceu). */
  const posByPeriod = useMemo<Record<Period, { pos: number; delta: number }>>(() => {
    const b = myRank ?? 0;
    return {
      diario:  { pos: b ? b + 1 : 0, delta: 3 },
      semanal: { pos: b || 0, delta: 1 },
      mensal:  { pos: b ? Math.max(1, b - 1) : 0, delta: -2 },
      anual:   { pos: b ? Math.max(1, b - 2) : 0, delta: 5 },
    };
  }, [myRank]);

  /* [top1, top10, top50, eu] — "eu" por último pra ficar por cima.
   * Recalcula ao trocar o período (os traços mudam). */
  const meSpark = SPARKS[period].me;
  const chart = useMemo(() => {
    const s = SPARKS[period];
    return multiChartPaths([s.top1, s.top10, s.top50, s.me]);
  }, [period]);
  const series = chart.series;
  const mePts = series[3].pts;
  /* 4 marcos no eixo Y (pontos), do mínimo ao máximo da escala. */
  const yTicks = useMemo(() => {
    return [0, 1, 2, 3].map((k) => {
      const v = chart.min + (chart.span * k) / 3;
      const y = chart.toY(v);
      return { v, y, top: (y / CHART_H) * 100, label: `${Math.round(v / 1000)}k` };
    });
  }, [chart]);
  const xLabels = CHART_X_LABELS[period];

  const mission = MISSIONS[missionTab];

  const gallery = useMemo(() => {
    const src = storeTab === 'produtos' ? PRODUCTS : EXPERIENCES;
    const q = storeQuery.trim().toLowerCase();
    let arr = q ? src.filter((p) => p.name.toLowerCase().includes(q)) : src.slice();
    if (sort === 'menor') arr = arr.slice().sort((a, b) => a.cost - b.cost);
    else if (sort === 'maior') arr = arr.slice().sort((a, b) => b.cost - a.cost);
    else if (sort === 'novidades') arr = arr.slice().reverse();
    return arr;
  }, [storeTab, sort, storeQuery]);

  /* Sugestões do autocomplete da busca (nomes do catálogo atual). */
  const storeSuggestions = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return [] as StoreItem[];
    const src = storeTab === 'produtos' ? PRODUCTS : EXPERIENCES;
    return src.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [storeQuery, storeTab]);

  /* Autocomplete da busca da Classificação (nomes dos fãs). */
  const rankSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Row[];
    return rows.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, rows]);

  /* Validade do desconto: 30 dias a partir de hoje (cliente, modal só
   * monta após evento → sem risco de hydration mismatch). */
  const discountUntil = useMemo(
    () =>
      new Date(Date.now() + 30 * 86_400_000)
        .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
        .replace('.', ''),
    [],
  );

  if (!open) return null;

  const PERIOD_TABS: [Period, string][] = [
    ['diario', 'Diário'], ['semanal', 'Semanal'], ['mensal', 'Mensal'], ['anual', 'Anual'],
  ];

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={TAB_TITLE[tab]}>
      <div
        className={`${styles.backdrop} ${closing ? styles.backdropOut : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      <div className={`${styles.modal} ${closing ? styles.modalOut : ''}`}>
        {/* ===== HEADER — apenas o título + fechar ===== */}
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.titleMain}>{TAB_TITLE[tab]}</div>
          </div>

          <button type="button" className={styles.closeBtn} onClick={close} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {/* ===== ABAS PRINCIPAIS — fixas (fora do scroll) ===== */}
        <div className={styles.tabBar}>
          <div className={styles.mainTabs} role="tablist">
            {MAIN_TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`${styles.mainTab} ${tab === key ? styles.mainTabActive : ''}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== BODY ===== */}
        <div className={styles.body} ref={bodyRef}>
          {/* ===== MINHA EVOLUÇÃO ===== */}
          {tab === 'evolucao' && (
                  <div className={styles.card}>
                    {/* Header: título + filtro de período (dentro do box) */}
                    <div className={styles.evoTopRow}>
                      <span className={styles.cardTitle}>Minha Evolução</span>
                      <div className={styles.periodTabs} role="tablist">
                        {PERIOD_TABS.map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={period === key}
                            className={`${styles.tab} ${period === key ? styles.tabActive : ''}`}
                            onClick={() => setPeriod(key)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.evoMain}>
                      {/* ESQUERDA — dados do usuário logado */}
                      <div className={styles.evoStats}>
                        <div className={styles.evoStatsHead}>
                          <span className={styles.evoStatsAvatar} aria-hidden="true">
                            {me?.avatarUrl
                              ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={me.avatarUrl} alt="" className={styles.evoStatsAvatarImg} />
                              )
                              : (me ? me.initials : 'VC')}
                          </span>
                          <div className={styles.evoStatsText}>
                            <div className={styles.evoLabel}>Total</div>
                            <div className={styles.evoTotal}>{fmt(myPoints)} FP</div>
                          </div>
                        </div>
                        <div className={styles.evoVarRow}>
                          <span className={styles.evoVarLabel}>{PERIOD_NAME[period]}</span>
                          <span className={`${styles.delta} ${styles.deltaUp}`}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                            {fmt(periodFP)} FP
                          </span>
                        </div>
                        <div className={styles.divider} />
                        <div className={styles.evoLabel}>Por período</div>
                        <div className={styles.posList}>
                          {PERIOD_TABS.map(([key, label]) => {
                            const info = posByPeriod[key];
                            return (
                              <button
                                key={key}
                                type="button"
                                className={`${styles.posRow} ${period === key ? styles.posRowActive : ''}`}
                                onClick={() => setPeriod(key)}
                              >
                                <span className={styles.posLabel}>{label}</span>
                                <span className={styles.posRank}>{info.pos ? `#${info.pos}` : '—'}</span>
                                {info.delta !== 0 && (
                                  <span className={`${styles.delta} ${info.delta > 0 ? styles.deltaUp : styles.deltaDown}`}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={info.delta > 0 ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7'} /></svg>
                                    {Math.abs(info.delta)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* DIREITA — gráfico (top 3 sobre as linhas) */}
                      <div className={styles.evoChartCol}>
                        <div className={styles.chartWrap}>
                          <div className={styles.chartArea}>
                            {/* eixo Y — marcos de pontos */}
                            <div className={styles.yAxis}>
                              {yTicks.map((t) => (
                                <span key={t.v} className={styles.yTick} style={{ top: `${t.top}%` }} title={`${fmt(t.v)} Fanpoints`}>{t.label}</span>
                              ))}
                            </div>

                            <div className={styles.chartPlot}>
                              <svg viewBox="0 0 300 96" preserveAspectRatio="none" className={styles.chartSvg}>
                                <defs>
                                  <linearGradient id="rkArea" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
                                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                  </linearGradient>
                                </defs>
                                {/* gridlines horizontais nos marcos do eixo Y */}
                                {yTicks.map((t) => (
                                  <line key={t.v} x1="0" y1={t.y} x2="300" y2={t.y} stroke="rgba(255,255,255,.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                                ))}
                                {/* referência: Top 1 / Top 10 / Top 50 (linhas finas) */}
                                <path d={series[0].line} fill="none" stroke="#ff2e9a" strokeWidth="1.6" strokeOpacity="0.85" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                                <path d={series[1].line} fill="none" stroke="#a855f7" strokeWidth="1.6" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                                <path d={series[2].line} fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                                {/* você (linha branca cheia + área) */}
                                <path d={series[3].area} fill="url(#rkArea)" />
                                <path d={series[3].line} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                              </svg>

                              {/* marcos clicáveis da minha linha + tooltip */}
                              <div className={styles.chartDots}>
                                {mePts.map((p, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    className={styles.chartDot}
                                    style={{ left: `${(p[0] / CHART_W) * 100}%`, top: `${(p[1] / CHART_H) * 100}%` }}
                                    title={`${xLabels[i]} · ${fmt(meSpark[i])} FP`}
                                    aria-label={`${xLabels[i]}: ${fmt(meSpark[i])} Fanpoints`}
                                    onMouseEnter={() => setHoverPt(i)}
                                    onMouseLeave={() => setHoverPt(null)}
                                    onFocus={() => setHoverPt(i)}
                                    onBlur={() => setHoverPt(null)}
                                  />
                                ))}
                                {hoverPt !== null && (
                                  <div
                                    className={styles.chartTip}
                                    style={{ left: `${(mePts[hoverPt][0] / CHART_W) * 100}%`, top: `${(mePts[hoverPt][1] / CHART_H) * 100}%` }}
                                  >
                                    <strong>{fmt(meSpark[hoverPt])} FP</strong>
                                    <span>{xLabels[hoverPt]}</span>
                                  </div>
                                )}
                              </div>

                              {/* TOP 3 sobre as linhas — só avatar; nome + FP no
                                  tooltip (hover no desktop, clique no mobile). */}
                              <div className={styles.chartTop3}>
                                {rows.slice(0, 3).map((r, i) => (
                                  <button
                                    key={r.rank}
                                    type="button"
                                    className={styles.top3Marker}
                                    style={{ left: `${(Number(series[i].cx) / CHART_W) * 100}%`, top: `${(Number(series[i].cy) / CHART_H) * 100}%` }}
                                    onMouseEnter={() => setTop3Open(i)}
                                    onMouseLeave={() => setTop3Open(null)}
                                    onClick={() => setTop3Open((v) => (v === i ? null : i))}
                                    aria-label={`${r.name.replace('Você · ', '')}: ${r.points}`}
                                  >
                                    {r.avatarUrl
                                      ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={r.avatarUrl} alt="" className={styles.top3MarkerImg} />
                                      )
                                      : <span className={styles.top3MarkerInitials}>{r.initials}</span>}
                                  </button>
                                ))}
                                {top3Open !== null && rows[top3Open] && (
                                  <div
                                    className={styles.top3Tip}
                                    style={{ left: `${(Number(series[top3Open].cx) / CHART_W) * 100}%`, top: `${(Number(series[top3Open].cy) / CHART_H) * 100}%` }}
                                  >
                                    <strong>{rows[top3Open].name.replace('Você · ', '')}</strong>
                                    <span>{rows[top3Open].points}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* eixo X — marcos de tempo (dia/semana/mês) */}
                          <div className={styles.xAxis}>
                            <div className={styles.xTicks} title={CHART_X_TIP[period]}>
                              {xLabels.map((l, i) => (
                                <span key={l} className={styles.xTick} style={{ left: `${(i / (xLabels.length - 1)) * 100}%` }} title={`${l} · ${fmt(meSpark[i])} FP`}>{l}</span>
                              ))}
                            </div>
                          </div>

                          <div className={styles.chartLegend}>
                            <span className={styles.legendItem}><i className={styles.legendDot} style={{ background: '#fff' }} />Você</span>
                            <span className={styles.legendItem}><i className={styles.legendDot} style={{ background: '#ff2e9a' }} />Top 1</span>
                            <span className={styles.legendItem}><i className={styles.legendDot} style={{ background: '#a855f7' }} />Top 10</span>
                            <span className={styles.legendItem}><i className={styles.legendDot} style={{ background: 'rgba(255,255,255,.5)' }} />Top 50</span>
                          </div>
                        </div>
                      </div>
                    </div>

                        {/* MISSÕES — logo abaixo do gráfico (antes de Conquistas) */}
                        <div className={styles.missionsBlock}>
                          <div className={styles.missionsHead}>
                            <span className={styles.cardTitle}>Minhas Missões</span>
                            <div className={styles.missionTabs}>
                              {(['diaria', 'semanal'] as MissionTab[]).map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  className={`${styles.segSm} ${missionTab === k ? styles.segActive : ''}`}
                                  onClick={() => setMissionTab(k)}
                                >
                                  {k === 'diaria' ? 'Diária' : 'Semanal'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className={styles.mProgressRow}>
                            <span className={styles.mTitle}>{mission.title}</span>
                            <span className={styles.mCount}>{mission.count}</span>
                          </div>
                          <div className={styles.mTrack}>
                            <div className={styles.mFill} style={{ width: mission.pct }} />
                          </div>
                          <div className={styles.mMetaRow}>
                            <span className={styles.mMeta}>{mission.metaLeft}</span>
                            <span className={styles.mReward}>{mission.reward}</span>
                          </div>

                          <div className={styles.mDetailsWrap}>
                            <button type="button" className={styles.mDetailsToggle} onClick={() => setMissionsOpen((v) => !v)}>
                              <span>{missionsOpen ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
                              <span className={`${styles.chevron} ${missionsOpen ? styles.chevronOpen : ''}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                              </span>
                            </button>
                            {missionsOpen && (
                              <div className={styles.mDetails}>
                                {mission.details.map((d) => (
                                  <div key={d.label} className={styles.mDetailRow}>
                                    <span className={`${styles.mCheck} ${d.done ? styles.mCheckDone : ''}`}>
                                      {d.done && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0b0b0d" strokeWidth="3.4"><path d="M5 12l5 5L20 7" /></svg>
                                      )}
                                    </span>
                                    <span className={`${styles.mDetailLabel} ${d.done ? styles.mDetailDone : ''}`}>{d.label}</span>
                                  </div>
                                ))}
                                <div className={styles.mNote}>{mission.note}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Conquistas — depois das Missões (ordem invertida). */}
                        <div className={styles.achWrap} ref={achRef}>
                          <div className={styles.achHead}>
                            <span className={styles.cardTitle}>Conquistas</span>
                          </div>
                          <div className={styles.achPanel}>
                            <div className={styles.perkList}>
                              {BADGES.map((pk) => (
                                <div key={pk.label} className={styles.perk}>
                                  <span className={styles.perkLabel}>{pk.label}</span>
                                  <span className={styles.perkSub}>{pk.sub}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                  </div>
                  )}

                  {/* ===== JORNADA — o que os superfãs desbloqueiam por marco
                       (mesmo conteúdo da aba Benefícios do modal Fanpoints) ===== */}
                  {tab === 'jornada' && (
                    <div className={styles.jornada}>
                      <BeneficiosTab fanpoints={saldoFP} currentTier={currentTierForRank(myRank ?? 0)} />
                    </div>
                  )}

                {/* ===== CLASSIFICAÇÃO ===== */}
                {tab === 'classificacao' && (
                  <div className={styles.rankCard}>
                    {/* Filtro de dias + legenda do período, dentro do box. */}
                    <div className={styles.rankHeadTabs}>
                      {/* Filtro discreto (badges) — à esquerda, Hoje default. */}
                      <div className={styles.periodBadges} role="tablist">
                        {PERIOD_TABS.map(([key]) => (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={period === key}
                            className={`${styles.periodBadge} ${period === key ? styles.periodBadgeActive : ''}`}
                            onClick={() => setPeriod(key)}
                          >
                            {PERIOD_BADGE[key]}
                          </button>
                        ))}
                      </div>

                      {/* Legenda do período — centralizada. */}
                      <div className={styles.periodMeta}>
                        <span className={styles.periodLabel}>{pm.label}</span>
                        <span className={styles.dot} />
                        <span className={styles.periodRange}>{pm.range}</span>
                      </div>

                      {/* Busca (mesmo comportamento da Loja) — à direita. */}
                      <div className={styles.galleryTools}>
                        <button
                          type="button"
                          className={`${styles.searchBtn} ${rankSearchOpen ? styles.searchBtnActive : ''}`}
                          aria-label="Buscar fã"
                          aria-expanded={rankSearchOpen}
                          onClick={() => {
                            setRankSearchOpen((v) => {
                              if (v) setQuery('');
                              return !v;
                            });
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                        </button>
                        {rankSearchOpen && (
                          <div className={`${styles.searchWrap} ${styles.searchWrapRight}`}>
                            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                            <input
                              autoFocus
                              type="text"
                              className={styles.searchInput}
                              placeholder="Buscar fã…"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                            />
                            {rankSuggestions.length > 0 && (
                              <ul className={styles.autocomplete}>
                                {rankSuggestions.map((s) => (
                                  <li key={s.rank}>
                                    <button
                                      type="button"
                                      className={styles.autocompleteItem}
                                      onClick={() => setQuery(s.name.replace('Você · ', ''))}
                                    >
                                      {s.name.replace('Você · ', '')}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Top 10 — cada usuário em card individual. */}
                    <div className={styles.list}>
                      {list.slice(0, visibleCount).map((r) => (
                        <motion.div
                          key={r.rank}
                          className={`${styles.row} ${r.you ? styles.rowYou : ''}`}
                          whileHover={{ y: -2, scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                        >
                          <span className={styles.rankNum} style={{ color: r.rankColor }}>{`#${r.rank}`}</span>
                          <span className={styles.avatarWrap}>
                            <span className={styles.avatar} style={{ borderColor: r.ring }}>
                              {r.avatarUrl
                                ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={r.avatarUrl} alt="" className={styles.avatarImg} />
                                )
                                : r.initials}
                            </span>
                            <RankMedallion position={r.rank} size="sm" />
                          </span>
                          <div className={styles.info}>
                            <span className={styles.name}>{r.name}</span>
                            {r.city && <span className={styles.city}>{r.city}</span>}
                          </div>
                          <div className={styles.pointsCol}>
                            <span className={styles.points}>{r.points}</span>
                            {r.delta !== 0 && (
                              <span className={`${styles.delta} ${r.delta > 0 ? styles.deltaUp : styles.deltaDown}`}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <path d={r.delta > 0 ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7'} />
                                </svg>
                                {Math.abs(r.delta)}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                      {list.length === 0 && (
                        <div className={styles.empty}>
                          {rankingLoading ? 'Carregando ranking…' : 'Sem fãs no ranking ainda.'}
                        </div>
                      )}
                    </div>
                    {list.length > visibleCount && (
                      <button
                        type="button"
                        className={styles.loadMore}
                        onClick={() => setVisibleCount((c) => c + 10)}
                      >
                        Carregar mais
                      </button>
                    )}
                  </div>
                  )}

                  {/* ===== LOJA ===== */}
                  {tab === 'loja' && (
            <div className={styles.store}>
              <div className={styles.storeLeft}>
                {/* SALDO */}
                <div className={styles.card}>
                  <div className={styles.balTop}>
                    <span className={styles.balAvatar} aria-hidden="true">
                      {me?.avatarUrl
                        ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={me.avatarUrl} alt="" className={styles.balAvatarImg} />
                        )
                        : (me ? me.initials : 'VC')}
                    </span>
                    <div className={styles.balText}>
                      <div className={styles.balLabel}>Meu saldo</div>
                      <div className={styles.balValue}>{fmt(saldoFP)} FP</div>
                    </div>
                  </div>
                  <div className={styles.balSub}>disponível para troca</div>
                  <div className={styles.discountRow}>
                    <div>
                      <div className={styles.discountInfo}>Desconto desbloqueado</div>
                      <div className={styles.discountInfo}>válido até {discountUntil}</div>
                    </div>
                    <span className={styles.discountBadge}>15% OFF</span>
                  </div>
                  <button type="button" className={styles.dadosBtn} onClick={() => flash('Meus dados — gerenciar endereços…')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Meus dados
                  </button>
                </div>
              </div>

              {/* GALERIA */}
              <div className={styles.galleryCol}>
                <div className={styles.galleryHead}>
                  {/* Busca (lupa) — no lugar das antigas tabs, à esquerda */}
                  <div className={styles.galleryTools}>
                    <button
                      type="button"
                      className={`${styles.searchBtn} ${searchOpen ? styles.searchBtnActive : ''}`}
                      aria-label="Buscar"
                      aria-expanded={searchOpen}
                      onClick={() => {
                        setSearchOpen((v) => {
                          if (v) setStoreQuery('');
                          return !v;
                        });
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                    </button>
                    {searchOpen && (
                      <div className={styles.searchWrap}>
                        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                        <input
                          autoFocus
                          type="text"
                          className={styles.searchInput}
                          placeholder="Buscar item…"
                          value={storeQuery}
                          onChange={(e) => setStoreQuery(e.target.value)}
                        />
                        {storeSuggestions.length > 0 && (
                          <ul className={styles.autocomplete}>
                            {storeSuggestions.map((s) => (
                              <li key={s.name}>
                                <button
                                  type="button"
                                  className={styles.autocompleteItem}
                                  onClick={() => setStoreQuery(s.name)}
                                >
                                  {s.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ordenação à direita */}
                  <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
                    <option value="relevancia">Ordenar: Relevância</option>
                    <option value="menor">Menor preço</option>
                    <option value="maior">Maior preço</option>
                    <option value="novidades">Novidades</option>
                  </select>
                </div>

                {/* Filtros estilo e-commerce: Experiências / Produtos */}
                <div className={styles.storeFilters} role="tablist">
                  {(['experiencias', 'produtos'] as StoreTab[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={storeTab === k}
                      className={`${styles.storeFilterChip} ${storeTab === k ? styles.storeFilterActive : ''}`}
                      onClick={() => setStoreTab(k)}
                    >
                      {k === 'experiencias' ? 'Experiências' : 'Produtos'}
                    </button>
                  ))}
                </div>

                <div className={styles.products}>
                  {gallery.map((p) => {
                    const ok = saldoFP >= p.cost;
                    const cta = ok
                      ? (storeTab === 'produtos' ? 'Resgatar produto' : 'Resgatar experiência')
                      : `Faltam ${fmt(p.cost - saldoFP)} FP`;
                    return (
                      <div key={p.name} className={styles.product}>
                        <ProductSlider discount={p.discount} />
                        <div className={styles.productBody}>
                          <div className={styles.productName}>{p.name}</div>
                          <div className={styles.productPriceRow}>
                            <span className={styles.productCost}>
                              <svg className={styles.tagIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
                              {fmt(p.cost)} FP
                            </span>
                            {p.original && <span className={styles.productOriginal}>{fmt(p.original)} FP</span>}
                          </div>
                          <button
                            type="button"
                            className={`${styles.productCta} ${ok ? styles.productCtaOk : styles.productCtaOff}`}
                            onClick={() => flash(ok ? `Resgatando: ${p.name}` : 'Saldo insuficiente para este item')}
                          >
                            {cta}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={styles.toast} role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2.4"><path d="M5 12l5 5L20 7" /></svg>
          {toast}
        </div>
      )}
    </div>
  );
}
