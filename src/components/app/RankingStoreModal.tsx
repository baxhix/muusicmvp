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
import { globeStore } from '@/lib/globeStore';
import RankMedallion from './RankMedallion';
import TruncatedText from './TruncatedText';
import { BeneficiosTab, currentTierForRank } from './FanpointsModal';
import styles from './RankingStoreModal.module.css';

type Screen = 'ranking' | 'evolucao' | 'loja';
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

/* Conquistas (mock) — o rótulo do mês é calculado em runtime (mês
 * anterior ao atual), não fixo, pra não envelhecer. Ver `badges` no
 * componente. */

/* Imagens do slider dos produtos (mock). Salve os arquivos em
 * public/store/ — fundo branco no slot, contain pra mostrar a peça
 * inteira. */
const PRODUCT_IMAGES = ['/store/produto-1.webp', '/store/produto-2.webp'];

/* Rótulo/intervalo cosmético por período — calculado em runtime a
 * partir da data atual (ver `periodMeta` no componente). Antes era
 * fixo ("Hoje · 16 jun"), o que envelhecia. */

/* Abas principais do modal. Ordem fixa pedida pelo produto. */
const MAIN_TABS: [Tab, string][] = [
  ['classificacao', 'Classificação'],
  ['evolucao', 'Evolução'],
  ['jornada', 'Jornada'],
  ['loja', 'Loja'],
];
const TAB_TITLE: Record<Tab, string> = {
  classificacao: 'Ranking Fanverse',
  evolucao: 'Minha Evolução',
  jornada: 'Sua Jornada',
  loja: 'Loja Fanverse',
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

/* Semente por período pro mock determinístico do gráfico de Evolução
 * (score do período + posições subidas). Cada período "embaralha"
 * diferente, então quem pontuou muito numa semana pode não ter pontuado
 * no mês. */
const PERIOD_SEED: Record<Period, number> = {
  diario: 7,
  semanal: 3,
  mensal: 11,
  anual: 5,
};

/* ── Helpers ──────────────────────────────────────────────────── */

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

/* PRNG determinístico (hash de 2 inteiros → 0..1). Sem histórico real
 * ainda; serve pra ilustrar pontuação/posições por período de forma
 * estável (mesmo resultado a cada render). */
const prand = (a: number, b: number) => {
  let x = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) >>> 0;
  x = (Math.imul(x ^ (x >>> 13), 1274126177)) >>> 0;
  return (x % 1000) / 1000;
};

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '·';

interface Row {
  rank: number; pts: number; you: boolean; userId: string; name: string; city: string;
  avatarUrl: string | null; initials: string; points: string;
  ring: string; rankColor: string; delta: number;
}

/* Uma barra do gráfico de Evolução: o usuário, os pontos que fez no
 * período, quantas posições subiu e a altura (%) da barra. */
interface BarUser {
  row: Row; periodPts: number; climb: number; isTopScorer: boolean; h: number;
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
  const [hoverBar, setHoverBar] = useState<number | null>(null);
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
      setTab(
        detail?.screen === 'loja'
          ? 'loja'
          : detail?.screen === 'evolucao'
          ? 'evolucao'
          : 'classificacao',
      );
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

  /* Rótulo/intervalo por período derivados da data REAL (recalcula a
   * cada abertura). Sem hydration risk: o modal só monta após o evento
   * de abertura (client). Antes era fixo "Hoje · 16 jun / Encerra em
   * 13h 42min" e envelhecia. */
  const periodMeta = useMemo<Record<Period, { label: string; range: string }>>(() => {
    const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const MESLONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const now = new Date();
    const dd = (d: Date) => String(d.getDate()).padStart(2, '0');

    // Diário — encerra à meia-noite.
    const eod = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msDay = eod.getTime() - now.getTime();
    const hDay = Math.floor(msDay / 3_600_000);
    const mDay = Math.floor((msDay % 3_600_000) / 60_000);

    // Semanal — segunda a domingo.
    const dow = (now.getDay() + 6) % 7; // 0 = segunda
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    const eow = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 1);
    const msWeek = eow.getTime() - now.getTime();
    const dWeek = Math.floor(msWeek / 86_400_000);
    const hWeek = Math.floor((msWeek % 86_400_000) / 3_600_000);
    const startYear = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(((now.getTime() - startYear.getTime()) / 86_400_000 + startYear.getDay() + 1) / 7);
    const weekLabel = mon.getMonth() === sun.getMonth()
      ? `${dd(mon)} – ${dd(sun)} ${MES[sun.getMonth()]}`
      : `${dd(mon)} ${MES[mon.getMonth()]} – ${dd(sun)} ${MES[sun.getMonth()]}`;

    // Mensal — dias até o fim do mês.
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - now.getDate();

    return {
      diario:  { label: `Hoje · ${dd(now)} ${MES[now.getMonth()]}`, range: `Encerra em ${hDay}h ${String(mDay).padStart(2, '0')}min` },
      semanal: { label: weekLabel, range: `Semana ${week} · termina em ${dWeek}d ${hWeek}h` },
      mensal:  { label: `${MESLONG[now.getMonth()]} ${now.getFullYear()}`, range: `Termina em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}` },
      anual:   { label: `${now.getFullYear()}`, range: 'Temporada anual' },
    };
    // `open` é dep proposital: recalcula a data/contagem a cada abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pm = periodMeta[period];

  /* Conquistas (mock) — mês anterior calculado em runtime. */
  const badges = useMemo(() => {
    const MESLONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const prev = MESLONG[(new Date().getMonth() + 11) % 12];
    return [{ label: 'Top 1%', sub: `Mês de ${prev}` }];
    // `open` é dep proposital: recalcula o mês a cada abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Abre o perfil do fã (fecha o modal e navega via globeStore). */
  const openProfile = useCallback((userId: string) => {
    if (!userId) return;
    globeStore.openUserProfile(userId);
    close();
  }, [close]);

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
        userId: r.userId,
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

  /* Classificação por PERÍODO: reordena e renumera os usuários por uma
   * pontuação determinística que muda a cada filtro (Hoje/Semana/Mês/Ano)
   * — só pra demonstrar que os dados mudam. O ranking all-time real fica
   * em `rows` (usado pela "minha" colocação e pelo gráfico de Evolução). */
  const periodRows = useMemo<Row[]>(() => {
    const seed = PERIOD_SEED[period];
    return rows
      .map((r) => ({ r, periodPts: 200 + Math.round(prand(r.rank, seed) * 9000) }))
      .sort((a, b) => b.periodPts - a.periodPts)
      .map(({ r, periodPts }, i) => ({
        ...r,
        rank: i + 1,
        pts: periodPts,
        points: `${fmt(periodPts)} FP`,
        delta: (((i + 1) * 7 + seed) % 9) - 4,
      }));
  }, [rows, period]);

  /* Top 3 em lista, igual aos demais (sem pódio) — a lista mostra
   * todas as colocações 1..N (já reordenadas pelo período). */
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? periodRows.filter((r) => r.name.toLowerCase().includes(q)) : periodRows;
  }, [periodRows, query]);

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

  /* Barras: os 8 superfãs que MAIS pontuaram no PERÍODO selecionado —
   * não necessariamente o top 8 geral (um #87 pode ter pontuado mais
   * que o #2 naquela semana). Sem formação pirâmide: exibidos por
   * colocação geral (asc), então as alturas ficam alternadas. Altura ∝
   * pontos do período; dentro de cada barra vai a seta + nº de posições
   * que aquele usuário subiu no período. Mock determinístico por período
   * (sem histórico real ainda) — "você" entra sempre no conjunto. */
  const barUsers = useMemo(() => {
    if (!rows.length) return [] as BarUser[];
    const seed = PERIOD_SEED[period];
    const scored = rows.map((row) => {
      /* "sel" decide QUEM entra; é independente do rank all-time → cada
       * filtro (Hoje/Semana/Mês/Ano) destaca um conjunto diferente de
       * superfãs. "periodPts" (altura/FP do período) é outro hash, então
       * as alturas ficam bem espalhadas (não grudadas no topo). */
      const sel = prand(row.rank, seed);
      const periodPts = 300 + Math.round(prand(row.rank, seed + 313) * 4500); // ~300..4800
      const climb = 1 + Math.round(prand(row.rank, seed + 91) * 24); // 1..25 posições
      return { row, sel, periodPts, climb };
    });
    let top = scored.slice().sort((a, b) => b.sel - a.sel).slice(0, 8);
    /* Garante "você" no gráfico (a aba é "Minha Evolução"). */
    if (me && !top.some((s) => s.row.you)) {
      const mine = scored.find((s) => s.row.you);
      if (mine) top = [...top.slice(0, 7), mine];
    }
    const max = Math.max(...top.map((s) => s.periodPts), 1);
    const topScorerRank = top.reduce((a, b) => (b.periodPts > a.periodPts ? b : a)).row.rank;
    /* TOP deixa folga acima da barra mais alta pro cap (avatar + #)
     * caber DENTRO da área do gráfico — sem ele estourar o topo. */
    const TOP = 76, BOT = 34;
    return top
      .slice()
      .sort((a, b) => a.row.rank - b.row.rank) // colocação geral asc → alturas alternadas
      .map((s) => ({
        row: s.row,
        periodPts: s.periodPts,
        climb: s.climb,
        isTopScorer: s.row.rank === topScorerRank,
        h: BOT + (s.periodPts / max) * (TOP - BOT),
      }));
  }, [rows, me, period]);

  /* Escala do eixo Y (Fanpoints do período) — derivada dos exibidos.
   * Rótulos top→base; ilustrativos. */
  const barTicks = useMemo(() => {
    const maxRaw = Math.max(...barUsers.map((b) => b.periodPts), 1);
    const mag = Math.pow(10, Math.floor(Math.log10(maxRaw)));
    const max = Math.ceil(maxRaw / mag) * mag;
    const lbl = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${Math.round(v)}`);
    return [3, 2, 1, 0].map((k) => ({ k, label: lbl((max * k) / 3) }));
  }, [barUsers]);

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
    return periodRows.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, periodRows]);

  /* Validade do desconto: 30 dias a partir de hoje. Formato fixo
   * "DD de mmm de AAAA" (ex.: 17 de jul de 2026), determinístico —
   * modal só monta após evento → sem risco de hydration mismatch. */
  const discountUntil = useMemo(() => {
    const d = new Date(Date.now() + 30 * 86_400_000);
    const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${String(d.getDate()).padStart(2, '0')} de ${MES[d.getMonth()]} de ${d.getFullYear()}`;
  }, []);

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
          {/* Voltar (←) à esquerda — mesmo padrão dos demais blocos do app. */}
          <button type="button" className={styles.closeBtn} onClick={close} aria-label="Voltar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>

          <div className={styles.titleBlock}>
            <div className={styles.titleMain}>{TAB_TITLE[tab]}</div>
          </div>
        </div>

        {/* Área de abas + conteúdo. position:relative pra ancorar o banner
            de destaque da Loja ATRÁS das tabs (desktop). Na Loja ganha a
            classe `tabsAreaLoja` → tabBar preto (tabs como nas outras abas)
            + conteúdo empurrado pra baixo (mostra mais a imagem). */}
        <div className={`${styles.tabsArea} ${tab === 'loja' ? styles.tabsAreaLoja : ''}`}>
        {/* Banner de destaque (desktop, só Loja): imagem fixa que fica
            POR TRÁS das tabs e do topo do conteúdo; ao rolar, o conteúdo
            + gradiente preto passam por cima. Oculto no mobile via CSS. */}
        {tab === 'loja' && <div className={styles.storeBanner} aria-hidden="true" />}

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
                    {/* Header: título + filtro de período em badges (mesmo
                        estilo da Classificação: Hoje/Semana/Mês/Ano). */}
                    <div className={styles.evoTopRow}>
                      <span className={styles.cardTitle}>Minha Evolução</span>
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

                      {/* DIREITA — gráfico de barras (1 por usuário; eu sempre
                          no centro e em destaque). Eixo Y de Fanpoints à
                          esquerda + grade de quadrantes atrás das barras. */}
                      <div className={styles.evoChartCol}>
                        <div className={styles.barChart} key={period}>
                          {/* Eixo Y — Fanpoints (mantido; só o eixo de baixo saiu) */}
                          <div className={styles.barYAxis} aria-hidden="true">
                            {barTicks.map((t) => (
                              <span key={t.k} className={styles.barYTick}>{t.label}</span>
                            ))}
                          </div>

                          <div className={styles.barPlot}>
                            {/* Quadrantes / grade atrás das barras */}
                            <div className={styles.barGrid} aria-hidden="true">
                              {[0, 1, 2, 3].map((k) => (
                                <span key={k} className={styles.barGridLine} style={{ top: `${(k / 3) * 100}%` }} />
                              ))}
                            </div>

                            <div className={styles.barCols} role="img" aria-label="Superfãs que mais pontuaram no período">
                              {barUsers.map(({ row, h, climb, periodPts, isTopScorer }, i) => {
                                const isYou = row.you;
                                const isTop = isTopScorer && !isYou;
                                const cleanName = row.name.replace('Você · ', '');
                                return (
                                  <div
                                    key={row.rank}
                                    className={styles.barCol}
                                    onMouseEnter={() => setHoverBar(i)}
                                    onMouseLeave={() => setHoverBar(null)}
                                  >
                                    <div className={styles.barTrack}>
                                      <motion.div
                                        className={`${styles.barFill} ${isYou ? styles.barFillYou : isTop ? styles.barFillTop1 : ''}`}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${h}%` }}
                                        transition={{ duration: 0.7, delay: 0.08 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                                      >
                                        {/* Dentro da barra: posições que subiu no período. */}
                                        <span className={styles.barClimb} aria-label={`Subiu ${climb} posições`}>
                                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                                          {climb}
                                        </span>
                                        {/* Topo da barra: avatar + colocação (sobe com a barra) */}
                                        <div className={styles.barCap}>
                                          {hoverBar === i && (
                                            <div className={styles.barTip}>
                                              <strong>{fmt(periodPts)} FP</strong>
                                              <span>{isYou ? 'Você' : cleanName}</span>
                                            </div>
                                          )}
                                          <span className={`${styles.barAvatar} ${isYou ? styles.barAvatarYou : isTop ? styles.barAvatarTop1 : ''}`} aria-hidden="true">
                                            {row.avatarUrl
                                              ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={row.avatarUrl} alt="" className={styles.barAvatarImg} />
                                              )
                                              : <span className={styles.barAvatarInitials}>{row.initials}</span>}
                                          </span>
                                          <span className={`${styles.barRank} ${isYou ? styles.barRankYou : isTop ? styles.barRankTop1 : ''}`}>{row.rank ? `#${row.rank}` : ''}</span>
                                        </div>
                                      </motion.div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                        {/* MISSÕES + CONQUISTAS — lado a lado, dois boxes */}
                        <div className={styles.evoBottomGrid}>
                        {/* MISSÕES */}
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
                              {badges.map((pk) => (
                                <div key={pk.label} className={styles.perk}>
                                  <span className={styles.perkLabel}>{pk.label}</span>
                                  <span className={styles.perkSub}>{pk.sub}</span>
                                </div>
                              ))}
                            </div>
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
                            <TruncatedText
                              as="button"
                              type="button"
                              className={styles.name}
                              title={r.name.replace('Você · ', '')}
                              onClick={() => openProfile(r.userId)}
                            >
                              {r.name}
                            </TruncatedText>
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
                {/* Título da loja, acima do card de saldo. */}
                <div className={styles.lojaHeading}>Loja da Boiadeira</div>
                {/* SALDO */}
                <div className={styles.card}>
                  {/* Saldo: rótulo numa linha, quantidade de Fanpoints na
                   *  linha de baixo (balStrong é display:block). */}
                  <div className={styles.balLine}>
                    Saldo disponível para troca:
                    <strong className={styles.balStrong}>{fmt(saldoFP)} Fanpoints</strong>
                  </div>
                  {/* Desconto (15% OFF) ANTES de Meus dados — ordem
                   *  invertida per feedback. */}
                  <div className={styles.discountRow}>
                    <span className={styles.discountBadge}>15% OFF</span>
                    <span className={styles.discountInfo}>
                      Válido até{' '}
                      <strong className={styles.discountStrong}>{discountUntil}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.dadosBtn}
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent('app:open-address-book'))
                    }
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Meus dados
                  </button>
                </div>

                {/* Filtros Experiências / Produtos — abaixo do box Meu saldo */}
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
                            {/* "De" (preço cheio riscado) na linha de cima; o
                                preço com desconto fica na linha de baixo. */}
                            <span className={styles.productOriginal}>{p.original ? `De ${fmt(p.original)} FP` : ' '}</span>
                            <span className={styles.productCost}>
                              <svg className={styles.tagIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
                              {fmt(p.cost)} FP
                            </span>
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
