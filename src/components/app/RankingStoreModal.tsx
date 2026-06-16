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
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import RankMedallion from './RankMedallion';
import styles from './RankingStoreModal.module.css';

type Screen = 'ranking' | 'loja';
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
  { label: 'Superfã', sub: 'Verificado' },
  { label: 'Top 1%', sub: 'Mês de maio' },
  { label: 'Maratonista', sub: 'Sequência 14d' },
  { label: 'Primeira live', sub: 'Assistida' },
];

const PERKS = [
  { label: '15% OFF', sub: 'Loja oficial' },
  { label: 'Frete grátis', sub: 'Próximo pedido' },
];

/* Sparkline decorativa (sem série temporal real ainda). */
const MOCK_SPARK = [6.2, 9.1, 7.5, 12, 14.4, 11, 16.4].map((x) => x * 1000);

/* Rótulo/intervalo cosmético por período (só ranking all-time existe). */
const PERIOD_META: Record<Period, { label: string; range: string }> = {
  diario:  { label: 'Hoje · 16 jun', range: 'Encerra em 13h 42min' },
  semanal: { label: '10 – 16 jun', range: 'Semana 24 · termina em 2d 6h' },
  mensal:  { label: 'Junho 2026', range: 'Termina em 14 dias' },
  anual:   { label: '2026', range: 'Temporada anual' },
};

const RANK_TITLE: Record<Period, string> = {
  diario: 'Classificação de hoje',
  semanal: 'Classificação da semana',
  mensal: 'Classificação de junho',
  anual: 'Classificação geral',
};

/* ── Helpers ──────────────────────────────────────────────────── */

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '·';

interface Row {
  rank: number; pts: number; you: boolean; name: string; city: string;
  avatarUrl: string | null; initials: string; points: string;
  ring: string; rankColor: string;
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
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [query] = useState('');
  const [toast, setToast] = useState('');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Dados reais ── */
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const { ranking, loading: rankingLoading } = useRanking(open);
  const saldoFP = profile?.fanpoints ?? 0;

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

  /* Linhas reais do ranking (all-time). O período é cosmético por
   * enquanto — todas as abas mostram a mesma lista real. */
  const rows = useMemo<Row[]>(() => {
    return ranking.map((r, i) => {
      const rank = i + 1;
      const isMe = !!user?.id && r.userId === user.id;
      const baseName = r.name?.trim() || 'Fã';
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

  const ch = useMemo(() => chartPaths(MOCK_SPARK), []);

  const mission = MISSIONS[missionTab];

  const gallery = useMemo(() => {
    const src = storeTab === 'produtos' ? PRODUCTS : EXPERIENCES;
    const arr = src.slice();
    if (sort === 'menor') arr.sort((a, b) => a.cost - b.cost);
    else if (sort === 'maior') arr.sort((a, b) => b.cost - a.cost);
    else if (sort === 'novidades') arr.reverse();
    return arr;
  }, [storeTab, sort]);

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
        {/* ===== HEADER — apenas o título + fechar ===== */}
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.titleMain}>{isRanking ? 'Ranking Fanverse' : 'Loja Fanverse'}</div>
            {!isRanking && <div className={styles.titleSub}>Troque seus Fanpoints por recompensas</div>}
          </div>

          <div className={styles.spacer} />

          <button type="button" className={styles.closeBtn} onClick={close} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {/* ===== BODY ===== */}
        <div className={styles.body}>
          {isRanking ? (
            <>
              {/* TOOLBAR — detalhe do período (esquerda) · tabs
                  (centro) · atalhos (direita). Grid 1fr auto 1fr. */}
              <div className={styles.toolbar}>
                <div className={styles.periodMeta}>
                  <span className={styles.periodLabel}>{pm.label}</span>
                  <span className={styles.dot} />
                  <span className={styles.periodRange}>{pm.range}</span>
                </div>

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

                <div className={styles.headerActions}>
                  <button type="button" title="Loja" className={styles.iconBtn} onClick={() => setScreen('loja')} aria-label="Abrir loja">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.6-5h14.8L21 9M3 9h18M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M9 13h6" /></svg>
                  </button>
                  <button type="button" title="Presentes" className={styles.iconBtn} onClick={() => flash('Abrindo Presentes…')} aria-label="Presentes">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16v4H4zM5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 21V8M12 8S11 3 8.5 3 6 6 6 6s.6 2 2.2 2M12 8s1-5 3.5-5S18 6 18 6s-.6 2-2.2 2" /></svg>
                  </button>
                </div>
              </div>

              <div className={styles.grid}>
                {/* PAINEL PESSOAL */}
                <div className={styles.colPersonal}>
                  {/* MINHA EVOLUÇÃO */}
                  <div className={styles.card}>
                    <div className={styles.evoHead}>
                      <span className={styles.cardTitle}>Minha Evolução</span>
                    </div>

                    <div className={styles.evoUser}>
                      <span className={styles.evoAvatar} aria-hidden="true">
                        {me?.avatarUrl
                          ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={me.avatarUrl} alt="" className={styles.evoAvatarImg} />
                          )
                          : (me ? me.initials : 'VC')}
                      </span>
                      <div className={styles.evoUserText}>
                        <div className={styles.evoName}>
                          {me ? me.name.replace('Você · ', 'Você · ') : 'Você'}
                        </div>
                        {me?.city && <div className={styles.evoMeta}>{me.city}</div>}
                      </div>
                    </div>

                    <div className={styles.evoPosRow}>
                          <div>
                            <div className={styles.kicker}>Posição</div>
                            <div className={styles.posValueRow}>
                              <span className={styles.posValue}>{myRank ? `#${myRank}` : '—'}</span>
                            </div>
                          </div>
                          <div className={styles.spacer} />
                          <div className={styles.fpBlock}>
                            <div className={styles.kicker}>Fanpoints</div>
                            <div className={styles.fpValue}>{fmt(myPoints)} FP</div>
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
                            <circle cx={ch.cx} cy={ch.cy} r="3.6" fill="#fff" stroke="#0d0d12" strokeWidth="2" />
                          </svg>
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
                              <div className={styles.perksTitle}>Benefícios desbloqueados</div>
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

                    {/* Lista 1..N — top3 em linha, igual aos demais
                        (sem pódio). #N + selo + FP no padrão Superfãs. */}
                    <div className={styles.list}>
                      {list.map((r) => (
                        <div key={r.rank} className={`${styles.row} ${r.you ? styles.rowYou : ''}`}>
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
                          <span className={styles.points}>{r.points}</span>
                        </div>
                      ))}
                      {list.length === 0 && (
                        <div className={styles.empty}>
                          {rankingLoading ? 'Carregando ranking…' : 'Sem fãs no ranking ainda.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
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
                  <div className={styles.balValue}>{fmt(saldoFP)} FP</div>
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
                        className={`${styles.storeTab} ${storeTab === k ? styles.storeTabActive : ''}`}
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
                    const ok = saldoFP >= p.cost;
                    const cta = ok
                      ? (storeTab === 'produtos' ? 'Resgatar produto' : 'Resgatar experiência')
                      : `Faltam ${fmt(p.cost - saldoFP)} FP`;
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
