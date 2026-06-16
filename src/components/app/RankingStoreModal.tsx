'use client';

/**
 * RankingStoreModal — modal "Ranking completo + Loja" do Fanverse.
 *
 * Porte 1:1 do wireframe standalone (dc-runtime export) para a stack
 * do app: React + CSS Modules. TODOS os dados são mock client-side
 * nesta 1ª versão (ranking, períodos, missões, conquistas, catálogo
 * da loja) — vira real depois (useRanking/useUserProfile/schema da
 * loja). Resgate só simula (toast).
 *
 * Abre via CustomEvent('app:open-ranking-store', { detail:{ screen }})
 * — mesmo padrão do FanpointsModal/FanverseSearch. O "Ver mais" da
 * aba Superfãs (ArtistBox/rail) abre no Ranking; o atalho/ícone Loja
 * abre na tela Loja. Fecha por Esc, backdrop ou X.
 *
 * Duas telas (state.screen):
 *  - 'ranking': painel pessoal (Minha Evolução + Missões) + pódio Top 3
 *    + lista #4..#N, com tabs de período (Diário/Semanal/Mensal/Anual).
 *  - 'loja': saldo + endereços + galeria (Experiências/Produtos) com
 *    troca por Fanpoints.
 *
 * Responsivo: desktop 2 colunas; <900px empilha; grid da loja colapsa.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './RankingStoreModal.module.css';

type Screen = 'ranking' | 'loja';
type Period = 'diario' | 'semanal' | 'mensal' | 'anual';
type StoreTab = 'experiencias' | 'produtos';
type Sort = 'relevancia' | 'menor' | 'maior' | 'novidades';
type MissionTab = 'diaria' | 'semanal';
type EvoTab = 'evolucao' | 'estatisticas';

/* ── Mock data (portado de logic.js) ──────────────────────────── */

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

interface BaseFan { name: string; city: string; tier: string; lvl: number; w: number; delta: number }

const BASE: BaseFan[] = [
  { name: 'Marcelo Baxhix', city: 'Londrina, BR', tier: 'Lenda', lvl: 42, w: 311884, delta: 0 },
  { name: 'Camila Reis', city: 'São Paulo, BR', tier: 'Mestre', lvl: 39, w: 184220, delta: 1 },
  { name: 'Rafael Malmegrin', city: 'Curitiba, BR', tier: 'Diamante', lvl: 36, w: 142485, delta: -1 },
  { name: 'VG', city: 'Goiânia, BR', tier: 'Diamante', lvl: 34, w: 98560, delta: 2 },
  { name: 'Alberto Souza', city: 'Belo Horizonte, BR', tier: 'Platina', lvl: 31, w: 72020, delta: 0 },
  { name: 'Isabela Martins', city: 'Recife, BR', tier: 'Platina', lvl: 29, w: 61340, delta: 3 },
  { name: 'Caio Fernandes', city: 'Porto Alegre, BR', tier: 'Ouro', lvl: 26, w: 49870, delta: -2 },
  { name: 'Bruna Lima', city: 'Salvador, BR', tier: 'Ouro', lvl: 24, w: 41230, delta: 1 },
  { name: 'Diego Alves', city: 'Manaus, BR', tier: 'Prata', lvl: 21, w: 38910, delta: 0 },
  { name: 'Marina Costa', city: 'Fortaleza, BR', tier: 'Prata', lvl: 19, w: 33450, delta: 4 },
  { name: 'Thiago Nunes', city: 'Brasília, BR', tier: 'Prata', lvl: 18, w: 29700, delta: -1 },
  { name: 'Patrícia Gomes', city: 'Natal, BR', tier: 'Prata', lvl: 16, w: 26840, delta: 2 },
  { name: 'Rodrigo Dias', city: 'Vitória, BR', tier: 'Prata', lvl: 15, w: 24110, delta: -1 },
];

interface PMeta { label: string; range: string; mult: number; myRank: number; streak: number; percentile: string; spark: number[] }

const PERIOD_META: Record<Period, PMeta> = {
  diario:  { label: 'Hoje · 16 jun', range: 'Encerra em 13h 42min', mult: 0.071, myRank: 9, streak: 14, percentile: 'Top 7%', spark: [1.2, 2.1, 1.8, 2.6, 2.4, 3.6, 4.18].map((x) => x * 1000) },
  semanal: { label: '10 – 16 jun', range: 'Semana 24 · termina em 2d 6h', mult: 1, myRank: 7, streak: 14, percentile: 'Top 4%', spark: [6.2, 9.1, 7.5, 12, 14.4, 11, 16.4].map((x) => x * 1000) },
  mensal:  { label: 'Junho 2026', range: 'Termina em 14 dias', mult: 3.93, myRank: 6, streak: 14, percentile: 'Top 3%', spark: [38, 52, 46, 61, 58, 74, 84].map((x) => x * 1000) },
  anual:   { label: '2026', range: 'Temporada anual', mult: 23.7, myRank: 5, streak: 14, percentile: 'Top 2%', spark: [120, 180, 240, 300, 360, 420, 480].map((x) => x * 1000) },
};

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
  { label: 'Superfã', sub: 'Verificado' },
  { label: 'Top 1%', sub: 'Mês de maio' },
  { label: 'Maratonista', sub: 'Sequência 14d' },
  { label: 'Primeira live', sub: 'Assistida' },
];

const PERKS = [
  { label: '15% OFF', sub: 'Loja oficial' },
  { label: 'Frete grátis', sub: 'Próximo pedido' },
];

const SALDO_FP = 54180;

const RANK_TITLE: Record<Period, string> = {
  diario: 'Classificação de hoje',
  semanal: 'Classificação da semana',
  mensal: 'Classificação de junho',
  anual: 'Classificação geral',
};

/* ── Helpers ──────────────────────────────────────────────────── */

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

interface Row {
  rank: number; pts: number; you: boolean; name: string; city: string;
  tier: string; lvl: number; initials: string; points: string;
  ring: string; rankColor: string; medal: string | null;
  trendIcon: string; trendText: string; trendColor: string;
}

function buildRows(period: Period): Row[] {
  const pm = PERIOD_META[period];
  const others = BASE.map((p) => ({ ...p, pts: Math.round(p.w * pm.mult) }));
  others.sort((a, b) => b.pts - a.pts);
  const youPts = Math.round(54180 * pm.mult);
  const youDeltaMap: Record<number, number> = { 9: 3, 7: 2, 6: 4, 5: 11 };
  const you = {
    name: 'Você · Lucas M.', city: 'Ribeirão Preto, BR', tier: 'Ouro', lvl: 25,
    pts: youPts, delta: youDeltaMap[pm.myRank] ?? 2, you: true,
  };
  const arr: (BaseFan & { pts: number; you?: boolean })[] = others.slice();
  arr.splice(pm.myRank - 1, 0, you as BaseFan & { pts: number; you?: boolean });
  return arr.map((p, i) => {
    const rank = i + 1;
    const clean = p.name.replace('Você · ', '');
    const initials = clean.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
    const up = p.delta > 0;
    const down = p.delta < 0;
    const medal = rank === 1 ? '#d8d8dc' : rank === 2 ? '#a6a6ad' : rank === 3 ? '#7d7d84' : null;
    return {
      rank, pts: p.pts, you: !!p.you,
      name: p.name, city: p.city, tier: p.tier, lvl: p.lvl, initials,
      points: `${fmt(p.pts)} FP`,
      ring: p.you ? 'rgba(255,255,255,.45)' : (medal || 'rgba(255,255,255,.14)'),
      rankColor: medal || (p.you ? '#fff' : 'rgba(255,255,255,.6)'),
      medal,
      trendIcon: up ? '▲' : (down ? '▼' : '–'),
      trendText: p.delta === 0 ? '' : String(Math.abs(p.delta)),
      trendColor: up ? 'rgba(255,255,255,.7)' : (down ? 'rgba(255,255,255,.32)' : 'rgba(255,255,255,.3)'),
    };
  });
}

function chartPaths(spark: number[]) {
  const n = spark.length;
  const W = 300;
  const H = 96;
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const span = (max - min) || 1;
  const pts = spark.map((v, i) => {
    const x = (i / (n - 1)) * W;
    const y = 84 - ((v - min) / span) * 66 + 6;
    return [x, y] as const;
  });
  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const last = pts[pts.length - 1];
  return { line, area, cx: last[0].toFixed(1), cy: last[1].toFixed(1) };
}

/* ── Component ────────────────────────────────────────────────── */

export default function RankingStoreModal() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [screen, setScreen] = useState<Screen>('ranking');
  const [period, setPeriod] = useState<Period>('semanal');
  const [storeTab, setStoreTab] = useState<StoreTab>('experiencias');
  const [sort, setSort] = useState<Sort>('relevancia');
  const [missionTab, setMissionTab] = useState<MissionTab>('diaria');
  const [evoTab, setEvoTab] = useState<EvoTab>('evolucao');
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Abre via evento global (detail.screen opcional). */
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { screen?: Screen } | undefined;
      setScreen(detail?.screen === 'loja' ? 'loja' : 'ranking');
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

  const pm = PERIOD_META[period];
  const rows = useMemo(() => buildRows(period), [period]);
  const me = useMemo(() => rows.find((r) => r.you)!, [rows]);
  const podium = useMemo(() => rows.slice(0, 3), [rows]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? rows.filter((r) => r.name.toLowerCase().includes(q))
      : rows.filter((r) => r.rank >= 4 && r.rank <= 13);
  }, [rows, query]);

  const ch = useMemo(() => chartPaths(pm.spark), [pm.spark]);
  const sparkDelta = pm.spark[pm.spark.length - 1] - pm.spark[pm.spark.length - 2];
  const youPts = me.pts;

  const stats = [
    { value: fmt(youPts), label: 'Fanpoints no período' },
    { value: '#4', label: 'Melhor posição' },
    { value: '128', label: 'Dias ativos' },
    { value: String(pm.streak), label: 'Sequência atual' },
    { value: '27', label: 'Conquistas' },
    { value: '9.842', label: 'Curtidas dadas' },
  ];

  const mission = MISSIONS[missionTab];

  const gallery = useMemo(() => {
    const src = storeTab === 'produtos' ? PRODUCTS : EXPERIENCES;
    const arr = src.slice();
    if (sort === 'menor') arr.sort((a, b) => a.cost - b.cost);
    else if (sort === 'maior') arr.sort((a, b) => b.cost - a.cost);
    else if (sort === 'novidades') arr.reverse();
    return arr;
  }, [storeTab, sort]);

  const setP = (p: Period) => { setPeriod(p); setQuery(''); setScreen('ranking'); };

  if (!open) return null;

  const isRanking = screen === 'ranking';

  const PERIOD_TABS: [Period, string][] = [
    ['diario', 'Diário'], ['semanal', 'Semanal'], ['mensal', 'Mensal'], ['anual', 'Anual'],
  ];

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={isRanking ? 'Ranking Fanverse' : 'Loja Fanverse'}>
      <div
        className={`${styles.backdrop} ${closing ? styles.backdropOut : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      <div className={`${styles.modal} ${closing ? styles.modalOut : ''}`}>
        {/* ===== HEADER ===== */}
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.titleMain}>{isRanking ? 'Ranking Fanverse' : 'Loja Fanverse'}</div>
            {isRanking ? (
              <div className={styles.titleSubRow}>
                <span className={styles.periodLabel}>{pm.label}</span>
                <span className={styles.dot} />
                <span className={styles.periodRange}>{pm.range}</span>
              </div>
            ) : (
              <div className={styles.titleSub}>Troque seus Fanpoints por recompensas</div>
            )}
          </div>

          <div className={styles.spacer} />

          {isRanking && (
            <div className={styles.periodTabs} role="tablist">
              {PERIOD_TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={period === key}
                  className={`${styles.tab} ${period === key ? styles.tabActive : ''}`}
                  onClick={() => setP(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className={styles.spacer} />

          {isRanking && (
            <div className={styles.headerActions}>
              <button type="button" title="Loja" className={styles.iconBtn} onClick={() => setScreen('loja')} aria-label="Abrir loja">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.6-5h14.8L21 9M3 9h18M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M9 13h6" /></svg>
              </button>
              <button type="button" title="Presentes" className={styles.iconBtn} onClick={() => flash('Abrindo Presentes…')} aria-label="Presentes">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16v4H4zM5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 21V8M12 8S11 3 8.5 3 6 6 6 6s.6 2 2.2 2M12 8s1-5 3.5-5S18 6 18 6s-.6 2-2.2 2" /></svg>
              </button>
            </div>
          )}

          <button type="button" className={styles.closeBtn} onClick={close} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {/* ===== BODY ===== */}
        <div className={styles.body}>
          {isRanking ? (
            <div className={styles.grid}>
              {/* PAINEL PESSOAL */}
              <div className={styles.colPersonal}>
                {/* MINHA EVOLUÇÃO */}
                <div className={styles.card}>
                  <div className={styles.evoHead}>
                    <span className={styles.cardTitle}>Minha Evolução</span>
                    <span className={styles.percentile}>{pm.percentile}</span>
                  </div>

                  <div className={styles.evoUser}>
                    <span className={styles.evoAvatar} aria-hidden="true">LM</span>
                    <div className={styles.evoUserText}>
                      <div className={styles.evoName}>Você · Lucas M.</div>
                      <div className={styles.evoMeta}>{me.tier} · Lv {me.lvl}</div>
                    </div>
                  </div>

                  <div className={styles.segTabs}>
                    {(['evolucao', 'estatisticas'] as EvoTab[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`${styles.seg} ${evoTab === k ? styles.segActive : ''}`}
                        onClick={() => setEvoTab(k)}
                      >
                        {k === 'evolucao' ? 'Evolução' : 'Estatísticas'}
                      </button>
                    ))}
                  </div>

                  {evoTab === 'evolucao' ? (
                    <>
                      <div className={styles.evoPosRow}>
                        <div>
                          <div className={styles.kicker}>Posição</div>
                          <div className={styles.posValueRow}>
                            <span className={styles.posValue}>#{pm.myRank}</span>
                            <span className={styles.posUp}>↑{me.trendText}</span>
                          </div>
                        </div>
                        <div className={styles.spacer} />
                        <div className={styles.fpBlock}>
                          <div className={styles.kicker}>Fanpoints</div>
                          <div className={styles.fpValue}>{fmt(youPts)} FP</div>
                          <div className={styles.fpDelta}>+{fmt(sparkDelta)} FP</div>
                        </div>
                      </div>

                      <div className={styles.chartWrap}>
                        <svg viewBox="0 0 300 96" preserveAspectRatio="none" className={styles.chartSvg}>
                          <defs>
                            <linearGradient id="rkArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
                              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={ch.area} fill="url(#rkArea)" />
                          <path d={ch.line} fill="none" stroke="#d4d4d8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx={ch.cx} cy={ch.cy} r="3.6" fill="#fff" stroke="#121214" strokeWidth="2" />
                        </svg>
                      </div>

                      <div className={styles.miniStats}>
                        <div className={styles.miniStat}>
                          <div className={styles.miniStatValue}>{pm.streak}</div>
                          <div className={styles.miniStatLabel}>dias de sequência</div>
                        </div>
                        <div className={styles.miniStat}>
                          <div className={styles.miniStatValue}>{me.tier}</div>
                          <div className={styles.miniStatLabel}>tier atual · Lv {me.lvl}</div>
                        </div>
                      </div>

                      {/* Conquistas */}
                      <div className={styles.achWrap}>
                        <button type="button" className={styles.achToggle} onClick={() => setAchievementsOpen((v) => !v)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 18h6M10 14v4M14 14v4M8 21h8" /></svg>
                          <span className={styles.achLabel}>Conquistas</span>
                          <span className={styles.achCount}>12</span>
                          <span className={styles.spacer} />
                          <span className={`${styles.chevron} ${achievementsOpen ? styles.chevronOpen : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                          </span>
                        </button>

                        {achievementsOpen && (
                          <div className={styles.achPanel}>
                            <div className={styles.badgeGrid}>
                              {BADGES.map((b) => (
                                <div key={b.label} className={styles.badge}>
                                  <span className={styles.badgeIcon}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#cfcfd2" strokeWidth="2" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" /></svg>
                                  </span>
                                  <div className={styles.badgeText}>
                                    <div className={styles.badgeTitle}>{b.label}</div>
                                    <div className={styles.badgeSub}>{b.sub}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className={styles.perksTitle}>Descontos e benefícios</div>
                            <div className={styles.perkList}>
                              {PERKS.map((pk) => (
                                <div key={pk.label} className={styles.perk}>
                                  <span className={styles.perkLabel}>{pk.label}</span>
                                  <span className={styles.perkSub}>{pk.sub}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={styles.statsGrid}>
                      {stats.map((s) => (
                        <div key={s.label} className={styles.statCard}>
                          <div className={styles.statCardValue}>{s.value}</div>
                          <div className={styles.statCardLabel}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* MISSÕES */}
                <div className={styles.card}>
                  <div className={styles.missionsHead}>
                    <span className={styles.cardTitle}>Missões</span>
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
              </div>

              {/* CLASSIFICAÇÃO */}
              <div className={styles.colRanking}>
                <div className={styles.rankCard}>
                  <div className={styles.rankHead}>
                    <span className={styles.cardTitle}>{RANK_TITLE[period]}</span>
                    <span className={styles.rankCount}>{rows.length} fãs</span>
                  </div>

                  {/* Pódio Top 3 */}
                  <div className={styles.podiumWrap}>
                    <div className={styles.podiumLabel}>Top 3</div>
                    <div className={styles.podiumGrid} style={{ opacity: pm.myRank <= 3 ? 1 : 0.7 }}>
                      {podium.map((p) => (
                        <div key={p.rank} className={styles.podiumCard}>
                          <span className={styles.podiumPlace} style={{ background: p.ring }}>{p.rank}</span>
                          <span className={styles.podiumAvatar}>{p.initials}</span>
                          <div className={styles.podiumInfo}>
                            <div className={styles.podiumName}>{p.name}</div>
                            <div className={styles.podiumPoints}>{p.points}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.divider} />

                  {/* Lista */}
                  <div className={styles.list}>
                    {list.map((r) => (
                      <div key={r.rank} className={`${styles.row} ${r.you ? styles.rowYou : ''}`}>
                        <div className={styles.rankCol}>
                          <span className={styles.rankNum} style={{ color: r.rankColor }}>{r.rank}</span>
                          <span className={styles.trend} style={{ color: r.trendColor }}>{r.trendIcon}{r.trendText}</span>
                        </div>
                        <span className={styles.avatar} style={{ borderColor: r.ring }}>{r.initials}</span>
                        <div className={styles.info}>
                          <span className={styles.name}>{r.name}</span>
                          <span className={styles.city}>{r.city}</span>
                        </div>
                        <span className={styles.points}>{r.points}</span>
                      </div>
                    ))}
                    {list.length === 0 && (
                      <div className={styles.empty}>Nenhum fã encontrado para &quot;{query}&quot;.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ===== LOJA ===== */
            <div className={styles.store}>
              <div className={styles.storeLeft}>
                {/* SALDO */}
                <div className={styles.card}>
                  <button type="button" className={styles.backBtn} onClick={() => setScreen('ranking')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    Voltar ao ranking
                  </button>
                  <div className={styles.balLabel}>Meu saldo</div>
                  <div className={styles.balValue}>{fmt(SALDO_FP)} FP</div>
                  <div className={styles.balSub}>disponível para troca</div>
                  <div className={styles.discountRow}>
                    <div>
                      <div className={styles.discountInfo}>Desconto desbloqueado</div>
                      <div className={styles.discountInfo}>válido na loja oficial</div>
                    </div>
                    <span className={styles.discountBadge}>15% OFF</span>
                  </div>
                  <div className={styles.divider} />
                  <div className={styles.balStats}>
                    <div className={styles.balStatRow}>
                      <span className={styles.balStatLabel}>Resgates realizados</span>
                      <span className={styles.balStatValue}>3</span>
                    </div>
                    <div className={styles.balStatRow}>
                      <span className={styles.balStatLabel}>Itens disponíveis</span>
                      <span className={styles.balStatValue}>{PRODUCTS.length}</span>
                    </div>
                  </div>
                </div>

                {/* MEUS DADOS */}
                <div className={styles.card}>
                  <div className={styles.dataHead}>
                    <span className={styles.cardTitle}>Meus dados</span>
                    <button type="button" className={styles.linkBtn} onClick={() => flash('Gerenciar endereços…')}>Gerenciar endereços</button>
                  </div>
                  <div className={styles.addrBox}>
                    <div className={styles.addrLabel}>Endereço cadastrado</div>
                    <div className={styles.addrValue}>Rua das Boiadeiras, 123 — Centro<br />Ribeirão Preto, SP · 14000-000</div>
                  </div>
                  <button type="button" className={styles.newAddrBtn} onClick={() => flash('Cadastrar novo endereço…')}>+ Novo endereço</button>
                </div>
              </div>

              {/* GALERIA */}
              <div className={styles.galleryCol}>
                <div className={styles.galleryHead}>
                  <div />
                  <div className={styles.storeTabs}>
                    {(['experiencias', 'produtos'] as StoreTab[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`${styles.storeTab} ${storeTab === k ? styles.segActive : ''}`}
                        onClick={() => setStoreTab(k)}
                      >
                        {k === 'experiencias' ? 'Experiências' : 'Produtos'}
                      </button>
                    ))}
                  </div>
                  <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
                    <option value="relevancia">Ordenar: Relevância</option>
                    <option value="menor">Menor preço</option>
                    <option value="maior">Maior preço</option>
                    <option value="novidades">Novidades</option>
                  </select>
                </div>

                <div className={styles.products}>
                  {gallery.map((p) => {
                    const ok = SALDO_FP >= p.cost;
                    const cta = ok
                      ? (storeTab === 'produtos' ? 'Resgatar produto' : 'Resgatar experiência')
                      : `Faltam ${fmt(p.cost - SALDO_FP)} FP`;
                    return (
                      <div key={p.name} className={styles.product}>
                        <div className={styles.productImg}>
                          {p.discount && <span className={styles.discountTag}>{p.discount}</span>}
                          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5L5 20" /></svg>
                        </div>
                        <div className={styles.productBody}>
                          <div className={styles.productName}>{p.name}</div>
                          <div className={styles.productPriceRow}>
                            <span className={styles.productCost}>{fmt(p.cost)} FP</span>
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
