'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import FanverseCore from '@/components/animations/FanverseCore';
import ProfileCardStack from './ProfileCardStack';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  FANVERSE_SEARCH_SNAPSHOT,
  type FanverseSearchUser,
} from '@/lib/fanverseSearchMocks';
import styles from './FanverseSearch.module.css';

/* Álbuns Ana Castela — entradas extras no carrossel de insights.
 *  Per spec atualizado "intercale os dados mocados com os álbuns".
 *  Cada álbum vira um insight com thumb 72×72 acima do texto +
 *  contagem mocada de ouvintes simultâneos pra dar contexto. */
const ANA_ALBUMS = [
  { key: 'album-fire-arena',          title: 'Fire Arena',                 cover: '/albuns/firearena.jpg',                  listeners: 2310 },
  { key: 'album-lets-go-rodeo',       title: "Let's Go Rodeo",             cover: '/albuns/lets-go-rodeo.jpg',              listeners: 1844 },
  { key: 'album-heranca-boiadeira',   title: 'Herança Boiadeira',          cover: '/albuns/heranca-boiadeira.jpg',          listeners: 1556 },
  { key: 'album-boiadeira-int',       title: 'Boiadeira Internacional',    cover: '/albuns/boiadeira-internacional.jpg',    listeners: 1287 },
  { key: 'album-heranca-vivo',        title: 'Herança Boiadeira ao vivo',  cover: '/albuns/heranca-boiadeira-ao-vivo.jpg',  listeners: 1023 },
] as const;

/**
 * FanverseSearch — overlay full-screen disparado pelo clique no
 * orbe FanverseCore.
 *
 * Layout v2 (per product feedback):
 *   1. Topbar: back + thumb da Ana Castela
 *   2. Hero: orbe rotacionando com 12 avatares flutuando ao
 *      redor (posições semi-aleatórias) + texto "Analisando
 *      atividade do mundo..."
 *   3. Headline 24px left-aligned, ROTACIONA a cada 4s entre
 *      "X pessoas curtindo Ana Castela", "X pessoas ouvindo a
 *      mesma música", "X pessoas ouvindo o mesmo álbum",
 *      "X países conectados". Cada frase tem um filtro próprio
 *      pra user list abaixo.
 *   4. Match pills — carrossel horizontal com 4px gradient
 *      border. "Você e {name}" bold branco, suffix cinza regular.
 *   5. User list filtrada pelo phrase atual.
 *
 * Dados: 100% mocados — `lib/fanverseSearchMocks.ts`.
 */

/* Coração compartilhado — mesmo SVG usado em CommentItem.
 * outlined com stroke 1.8, viewBox 0 0 24 24. Usado tanto na pill
 * de match quanto na user list (filled quando user.isLiked). */
function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/* Posições finais dos 11 avatares — anel PRÓXIMO ao orbe (não
 * atrás dele).
 *
 * Per product feedback "Os avatares devem ficar mais próximos ao
 * orbe" — antes (v5) eram perimetrais (6-92vw/vh). Agora ficam
 * num cluster apertado em volta da zona central do orbe (~50vw,
 * 35vh), respeitando a "área proibida" 40-60vw × 25-45vh onde o
 * orbe vive (evita os avatares aparecerem behind).
 *
 * Layout em 3 anéis concêntricos:
 *   - Anel próximo (4): just outside orb, NW/NE/SW/SE
 *   - Anel médio   (4): meio-distância, far W/E e mid-S
 *   - Anel amplo   (3): cantos pra dar volume sem afastar muito
 *
 * Como o fsRoam tem amplitude ±120-180px e os avatares estão
 * agora MAIS PERTO do orbe, eles passam por cima do orbe com
 * muito mais frequência — exatamente o que o produto quer ("ora
 * passam por cima do orbe"). */
const FLOATING_POSITIONS = [
  /* Cluster apertado em torno do orbe (~50vw, 35vh).
   * Per spec atualizado "Deixe os avatares próximos ao orbe",
   * estreitamos o cluster horizontalmente (32-68vw → 38-62vw)
   * e verticalmente (16-58vh → 18-52vh) — todos no anel
   * imediato do orbe sem afastar nas extremidades. */
  { top: '22vh', left: '38vw' },
  { top: '23vh', left: '62vw' },
  { top: '18vh', left: '50vw' },
  { top: '38vh', left: '30vw' },
  { top: '40vh', left: '70vw' },
  { top: '30vh', left: '26vw' },
  { top: '32vh', left: '74vw' },
  { top: '52vh', left: '38vw' },
  { top: '54vh', left: '62vw' },
  { top: '46vh', left: '32vw' },
  { top: '48vh', left: '68vw' },
];

/* Ordem de revelação por PROXIMIDADE ao orbe (~50vw, 35vh).
 *
 * Per product feedback "os do começo mais próximos ao orbe":
 * computamos distância euclidiana de cada FLOATING_POSITIONS[i]
 * ao centro do orbe e ordenamos crescente. O primeiro a aparecer
 * (idx 2 = 50vw/18vh) é o que está mais perto verticalmente; os
 * de cantos extremos (idx 5, 6) aparecem por último. */
const AVATAR_REVEAL_ORDER = [2, 1, 0, 7, 3, 9, 4, 10, 8, 6, 5];

/* Per product feedback "No mobile, diminua pela metade a quantidade
 * de avatares" — em mobile renderizamos só 6 (≈ metade dos 11
 * originais). */
const MOBILE_AVATAR_COUNT = 6;

/* Posições mobile-específicas, TODAS agrupadas em volta do orbe
 * (~50vw, ~22vh — center). Per product feedback "os avatares não
 * ficam próximos ao orbe e sobrepõem outros elementos" — antes
 * usávamos slice das posições desktop, que tinham avatares em
 * 40-58vh (longe demais do orbe mobile + sobrepondo cards/lista).
 *
 * Aqui mantemos todos os 6 entre 3-38vh, formando um anel apertado
 * em torno do orbe — sem invadir a área dos cards (>45vh) nem a
 * lista de usuários abaixo. */
const MOBILE_FLOATING_POSITIONS = [
  /* Per spec atualizado "Deixe os avatares próximos ao orbe" no
   *  mobile: cluster ainda mais apertado, lateral 30-70vw (era
   *  16-84vw) e vertical 6-32vh (era 3-38vh). Cabe perfeitamente
   *  ao redor do orbe novo +20% (168px). */
  { top: '6vh',  left: '50vw' },  // acima do orbe
  { top: '10vh', left: '70vw' },  // canto superior direito
  { top: '10vh', left: '30vw' },  // canto superior esquerdo
  { top: '20vh', left: '74vw' },  // lateral direita (altura do orbe)
  { top: '20vh', left: '26vw' },  // lateral esquerda (altura do orbe)
  { top: '32vh', left: '50vw' },  // abaixo do orbe
];

/* Timing dos stages.
 *
 * Per product feedback:
 *   - Avatares flutuam por 7s antes da headline aparecer (efeito
 *     "carregando").
 *   - Headline aparece em t=7s, centralizada e com fonte menor.
 *   - Match pills aparecem em t=11s (4s depois da headline).
 *   - User list aparece em t=15s (4s depois das pills).
 *
 * Tudo em ms pra clareza. */
const STAGE_HEADLINE_MS = 7000;
const STAGE_PILLS_MS = 11000;
const STAGE_LIST_MS = 15000;

/* Avatares só começam a aparecer depois de 3s (apenas orbe visível
 * antes disso). A partir daí, revelam um a um a cada 350ms na ordem
 * AVATAR_REVEAL_ORDER (do mais próximo ao mais distante do orbe). */
const AVATAR_REVEAL_START_MS = 3000;
const AVATAR_REVEAL_STEP_MS = 350;

/* Paths do roam — 4 variações de keyframes normalizadas (multiplicadas
 * pela amplitude no render time). Cada path tem 4-5 stops orgânicos
 * pra evitar movimento previsível. Combinadas com `repeatType: mirror`
 * fazem o avatar varrer e voltar suavemente. */
const ROAM_PATHS_X: number[][] = [
  [0, -1.2, 0.6, -0.4, 1.1, 0],
  [0, 1.0, -0.8, 0.5, -1.2, 0],
  [0, -0.5, 1.1, -1.0, 0.4, 0],
  [0, 1.2, -0.6, 0.8, -1.0, 0],
];
const ROAM_PATHS_Y: number[][] = [
  [0, 0.5, -1.0, 0.8, -0.3, 0],
  [0, -0.7, 0.9, -1.0, 0.5, 0],
  [0, 0.9, -0.4, 0.6, -1.1, 0],
  [0, -1.1, 0.7, -0.5, 1.0, 0],
];

/* Copy do "Analisando" — agora com fade in/out via CSS (sem
 * typewriter). Texto completo fica sempre montado; o efeito fade é
 * a animação fsAnalyzingFade no .analyzing. */
const ANALYZING_PHRASE = 'Analisando atividade musical...';

export default function FanverseSearch() {
  const isMobile = useIsMobile();
  /* Posições + ordem de reveal — desktop usa as 11 originais
   * sorted por distância (AVATAR_REVEAL_ORDER), mobile usa as 6
   * posições próprias (todas agrupadas perto do orbe), na ordem
   * que estão definidas. */
  const positions = isMobile ? MOBILE_FLOATING_POSITIONS : FLOATING_POSITIONS;
  const reveal = isMobile
    ? [0, 1, 2, 3, 4, 5]
    : AVATAR_REVEAL_ORDER;
  const renderedAvatarCount = positions.length;
  const [open, setOpen] = useState(false);
  /* 3 stages de reveal — cada um aparece em sequência:
   *   t=7s  showHeadline → headline centralizada
   *   t=11s showPills    → carrossel de match pills
   *   t=15s showList     → lista de usuários completa
   * Antes disso, só orbe + avatares flutuantes (efeito "carregando"). */
  const [showHeadline, setShowHeadline] = useState(false);
  const [showPills, setShowPills] = useState(false);
  const [showList, setShowList] = useState(false);
  /* showCards: ProfileCardStack inicialmente OCULTO per spec
   *  atualizado "Inicialmente deixe eles ocultos e apenas a
   *  lista de usuários". Usuário toggla via o botão de "card"
   *  no topo da lista. */
  const [showCards, setShowCards] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(0);
  /* Lista com infinite loading — começa com 20 nomes e a sentinela
   * no fim da lista, ao entrar no viewport via IntersectionObserver,
   * dispara carga de +20 simulando um fetch. Para no teto de 100
   * (cap da lista mocada). */
  const [visibleUsers, setVisibleUsers] = useState(20);
  /* Loading state pro shimmer "Carregando mais..." aparecer entre
   * o último user e a sentinela durante o fetch simulado. */
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  /* Scroll state — quando o usuário rola pra baixo, o orbe fica
   * fixo + menor e o back arrow continua na sua posição. */
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* Listener global pra abrir. */
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('app:open-fanverse-search', handler);
    return () => window.removeEventListener('app:open-fanverse-search', handler);
  }, []);

  /* Escape fecha; reveal staged em 3 etapas + avatares com delay. */
  useEffect(() => {
    if (!open) return;
    const tH = window.setTimeout(() => setShowHeadline(true), STAGE_HEADLINE_MS);
    const tP = window.setTimeout(() => setShowPills(true),    STAGE_PILLS_MS);
    const tL = window.setTimeout(() => setShowList(true),     STAGE_LIST_MS);
    /* Reveal staggered dos avatares agora é feito via `delay` no
     *  motion.transition de cada avatar — não precisa de timers JS. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(tH);
      window.clearTimeout(tP);
      window.clearTimeout(tL);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Reset ao fechar (anima de novo na próxima abertura). */
  useEffect(() => {
    if (!open) {
      setShowHeadline(false);
      setShowPills(false);
      setShowList(false);
      setShowCards(false);
      setPhraseIdx(0);
      setVisibleUsers(20);
      setScrolled(false);
    }
  }, [open]);

  /* Scroll listener com rAF throttle + hysteresis (entra em
   *  scrolled @ >80px, sai @ <40px) — antes era threshold fixo
   *  em 60 sem throttle, causando snap brusco e setState a
   *  cada frame de scroll. Agora o estado só muda 1x por frame
   *  e a hysteresis evita oscilação em scroll lento perto do
   *  threshold. */
  const scrollRafRef = useRef<number | null>(null);
  const handleScroll = () => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const y = el.scrollTop;
      setScrolled((prev) => {
        if (prev) return y > 40;     // sai do scrolled só abaixo de 40
        return y > 80;                // entra em scrolled só acima de 80
      });
    });
  };

  /* Cap do infinite loading: 100 (ou menos se o mock devolver
   *  menos). Quando atingir esse limite, a sentinela não dispara
   *  mais e o "Fim da lista" footer aparece. */
  const INFINITE_LOAD_CAP = 100;

  /* Snapshot precisa ser referenciado pelo effect abaixo, então
   *  declaramos aqui antes do useEffect (em vez de mais embaixo
   *  com o resto da lógica de rendering). */
  const snapshotForEffect = FANVERSE_SEARCH_SNAPSHOT;

  /* Infinite loading via IntersectionObserver. Anexa o observer
   *  na sentinela; quando entra no viewport (raiz = scrollRef),
   *  dispara um fetch simulado (setTimeout 600ms) que adiciona
   *  +20 users até atingir INFINITE_LOAD_CAP. */
  useEffect(() => {
    if (!showList) return;
    const sentinel = sentinelRef.current;
    const scrollEl = scrollRef.current;
    if (!sentinel || !scrollEl) return;
    /* Loaded all available users? não observa mais. */
    const totalAvailable = Math.min(
      snapshotForEffect.users.length,
      INFINITE_LOAD_CAP,
    );
    if (visibleUsers >= totalAvailable) return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        if (loadingMore) return;
        setLoadingMore(true);
        /* Simula fetch (600ms) — em produção plugar API real. */
        window.setTimeout(() => {
          setVisibleUsers((n) => Math.min(n + 20, totalAvailable));
          setLoadingMore(false);
        }, 600);
      },
      {
        root: scrollEl,
        /* rootMargin estende a zona de gatilho 120px antes do
         *  sentinela aparecer — começa o load enquanto o user
         *  ainda está rolando, dando uma sensação seamless. */
        rootMargin: '0px 0px 120px 0px',
        threshold: 0.01,
      },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [showList, visibleUsers, loadingMore, snapshotForEffect.users.length]);

  const snapshot = FANVERSE_SEARCH_SNAPSHOT;

  /* Insights — frases rotativas. Cada frase tem segments
   *  (text + bold flag) pra preservar destaques (número da
   *  contagem, nome do álbum etc.) mesmo com o efeito Split
   *  Text por palavra. Os 4 dados ficam intercalados com os 5
   *  álbuns Ana Castela, totalizando 9 entradas. */
  type Segment = { text: string; bold: boolean };
  type Phrase = {
    key: string;
    /* line1 = primeira linha (número + "pessoas" + conector).
     *  line2 = segunda linha, sempre bold — o "highlight" da
     *  frase. Per spec atualizado os termos Fire Arena, Ana
     *  Castela, mesma música, conectados agora etc. quebram
     *  pra linha de baixo dando destaque. */
    line1: Segment[];
    line2: string;
    album?: { title: string; cover: string };
  };
  const PHRASES: Phrase[] = useMemo(() => {
    const data: Phrase[] = [
      {
        key: 'data-all',
        line1: [
          { text: snapshot.peopleCount.toLocaleString('pt-BR'), bold: true },
          { text: ' ', bold: false },
          { text: 'pessoas', bold: true },
          { text: ' curtindo', bold: false },
        ],
        line2: 'Ana Castela com você',
      },
      {
        key: 'data-song',
        line1: [
          { text: snapshot.sameSongCount.toLocaleString('pt-BR'), bold: true },
          { text: ' ', bold: false },
          { text: 'pessoas', bold: true },
          { text: ' ouvindo', bold: false },
        ],
        line2: 'a mesma música que você',
      },
      {
        key: 'data-album',
        line1: [
          { text: snapshot.sameAlbumCount.toLocaleString('pt-BR'), bold: true },
          { text: ' ', bold: false },
          { text: 'pessoas', bold: true },
          { text: ' ouvindo', bold: false },
        ],
        line2: 'o mesmo álbum',
      },
      {
        key: 'data-countries',
        line1: [
          { text: String(snapshot.countriesCount), bold: true },
          { text: ' países', bold: false },
        ],
        line2: 'conectados agora',
      },
    ];
    const albums: Phrase[] = ANA_ALBUMS.map((a) => ({
      key: a.key,
      line1: [
        { text: a.listeners.toLocaleString('pt-BR'), bold: true },
        { text: ' ', bold: false },
        { text: 'pessoas', bold: true },
        { text: ' ouvindo', bold: false },
      ],
      line2: a.title,
      album: { title: a.title, cover: a.cover },
    }));
    /* Zip intercalado: data[0], album[0], data[1], album[1], ...
     *  Como tem 4 data + 5 albums, sobra 1 álbum no fim. */
    const out: Phrase[] = [];
    const max = Math.max(data.length, albums.length);
    for (let i = 0; i < max; i++) {
      if (i < data.length) out.push(data[i]);
      if (i < albums.length) out.push(albums[i]);
    }
    return out;
  }, [snapshot]);

  /* Rotaciona a cada 7s — per spec atualizado "mantenha por
   *  mais tempo o insight visível". Antes 4s, agora 7s pra dar
   *  espaço pro Split Text completar + leitura confortável. */
  useEffect(() => {
    if (!open || !showHeadline) return;
    const id = window.setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [open, showHeadline, PHRASES.length]);

  const currentPhrase = PHRASES[phraseIdx];

  if (!open) return null;

  return (
    <div
      className={`${styles.overlay} ${scrolled ? styles.scrolled : ''}`}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop blur — ocupa a tela inteira. Click fecha. */}
      <div
        className={styles.backdrop}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      {/* Camada de fundo (gradiente radial roxo/rosa). */}
      <div className={styles.bg} aria-hidden="true" />

      {/* Avatares flutuantes — refatorados com motion. Substitui
       *  3 animações CSS encadeadas (fsAvatarIn + fsRoamN +
       *  fsBlink) por uma única `animate` composta no motion.div.
       *
       *  Vantagem decisiva: motion compõe x/y/opacity num único
       *  transform/style por frame — antes 2 animações CSS
       *  disputavam `opacity` no mesmo elemento (fsBlink vencia
       *  silenciosamente fsAvatarIn). Aqui cada propriedade tem
       *  sua própria transition independente, sem conflito.
       *
       *  Reveal staggered via `delay` no transition (nada de timer
       *  + avatarsShown state). Mobile recebe amplitudes menores
       *  pra ficarem próximos do orbe estreito. */}
      <div className={styles.floatingLayer} aria-hidden="true">
        {snapshot.topListeners.slice(0, renderedAvatarCount).map((l, idx) => {
          const i = reveal[idx];
          const pos = positions[i];
          /* Reveal delay = 3s base + 350ms * ordem de proximidade */
          const revealDelay = (AVATAR_REVEAL_START_MS + idx * AVATAR_REVEAL_STEP_MS) / 1000;
          /* Amplitude do roam — menor no mobile pra avatares
           *  ficarem perto do orbe estreito. */
          const amp = isMobile ? 40 : 90;
          /* Keyframes do roam baseados no índice (4 variações pra
           *  evitar varredura sincrônica). Cada avatar tem seu
           *  próprio path orgânico. */
          const xPath = ROAM_PATHS_X[i % ROAM_PATHS_X.length].map((v) => v * amp);
          const yPath = ROAM_PATHS_Y[i % ROAM_PATHS_Y.length].map((v) => v * amp);
          /* Duração do roam — varia entre 7-11s pra dessincronizar */
          const roamDur = 7 + (i % 5);
          /* Blink: opacity oscilando entre 1 e 0.15 a cada 9-12s,
           *  com phase shift por avatar pra nem todos sumirem
           *  juntos. */
          const blinkDur = 9 + (i % 4);
          const blinkPhase = (i * 1.8) % blinkDur;
          return (
            <motion.div
              key={l.id}
              className={styles.floatingAvatar}
              style={{ top: pos.top, left: pos.left }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 1, 0.15, 1, 1],
                x: xPath,
                y: yPath,
              }}
              transition={{
                /* Opacity: fade-in inicial (delay), depois loop
                 *  cíclico de blink. `times` mapeia cada keyframe
                 *  a uma fração do ciclo. */
                opacity: {
                  duration: blinkDur,
                  times: [0, 0.12, 0.55, 0.7, 0.85, 1],
                  delay: revealDelay - blinkPhase,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
                /* x/y roam SEM delay — per spec "os avatares já
                 *  devem aparecer em movimento e não estáticos".
                 *  Removendo o `delay: revealDelay` faz o
                 *  movimento começar from t=0; a opacity ainda
                 *  esconde o avatar até revealDelay, então ele
                 *  "fade-in já em motion". */
                x: {
                  duration: roamDur,
                  repeat: Infinity,
                  repeatType: 'mirror',
                  ease: 'easeInOut',
                },
                y: {
                  /* Sem delay — avatares já em motion na mount. */
                  duration: roamDur * 1.13,
                  repeat: Infinity,
                  repeatType: 'mirror',
                  ease: 'easeInOut',
                },
              }}
              title={l.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.avatarUrl} alt={l.name} />
            </motion.div>
          );
        })}
      </div>

      {/* Back arrow — fixo no canto superior esquerdo per product
       * feedback "A seta de voltar deve ficar fixa também". Fora
       * de .scroll, posicionado position:fixed via CSS. */}
      <button
        type="button"
        className={styles.backBtn}
        onClick={() => setOpen(false)}
        aria-label="Voltar"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      {/* Header fixo — typewriter "Analisando..." + orbe.
       *
       * Per product feedback "Desça mais o orbe e ao fazer scroll
       * ele deve permanecer fixo em um tamanho menor". Esse wrapper
       * é position:fixed; ao scroll, recebe a classe .scrolled que
       * encolhe o orbe via transform: scale e sobe o conjunto. */}
      <div className={styles.fixedHeader}>
        <div className={styles.analyzing} aria-live="polite">
          <span className={styles.analyzingText}>{ANALYZING_PHRASE}</span>
        </div>
        <div className={styles.orbWrap} aria-hidden="true">
          <div className={styles.orb}>
            <FanverseCore />
          </div>
        </div>
        {/* Vinyl disc — agora SIBLING do .orbWrap (não filho). Per
         *  spec atualizado, orb fica mais acima e disc + thumb +
         *  insights movem 100px pra baixo, separando visualmente
         *  os 3 elementos. SEMPRE visível, gira em loop. */}
        <div className={styles.vinylWrap} aria-hidden="true">
          <div className={styles.vinyl} />
          <div className={styles.vinylHole} />
          <AnimatePresence mode="wait">
            {showHeadline && currentPhrase.album && (
              <motion.div
                key={currentPhrase.album.cover}
                className={styles.albumThumb}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                transformTemplate={(_props, generated) =>
                  `translate(-50%, -50%) ${generated}`
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentPhrase.album.cover}
                  alt={currentPhrase.album.title}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scroll vertical do conteúdo principal — só body (headline,
       * pills, list). Topbar e orbe estão fora do scroll (fixos). */}
      <div className={styles.scroll} ref={scrollRef} onScroll={handleScroll}>
        <div className={styles.body}>
          {/* Stage 1 (t=7s): headline centralizada com Split Text.
           *
           *  Per spec atualizado: insights menores e responsivos +
           *  efeito "Split text gradual" (word-by-word fade + slide
           *  via stagger no motion). Acima do texto, quando a frase
           *  tem `.album`, renderiza uma thumb 110×110 (90×90 mobile)
           *  que faz fade in/out junto com o AnimatePresence. */}
          {/* Album thumb agora vive dentro do .orbWrap no
           *  fixedHeader (sempre fixo + por cima do orbe no
           *  scroll, com vinyl spinning atrás). Removido daqui
           *  do body. */}

          {showHeadline && (
            <div className={styles.headline}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPhrase.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  aria-label={`${currentPhrase.line1.map((s) => s.text).join('')} ${currentPhrase.line2}`}
                >
                  {/* Per spec atualizado: 2 linhas — line1 (número
                   *  + "pessoas" + conector) acima, line2 (highlight
                   *  bold) abaixo. Cada line é um block separado
                   *  pra forçar a quebra. */}
                  <div className={styles.headlineLine1}>
                    {currentPhrase.line1.map((seg, i) => (
                      <span
                        key={i}
                        className={seg.bold ? styles.headlineBold : styles.headlineMuted}
                      >
                        {seg.text}
                      </span>
                    ))}
                  </div>
                  <div className={styles.headlineLine2}>
                    {currentPhrase.line2}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Profile card stack — versão compacta de perfis.
           *  Per spec atualizado, inicialmente OCULTO. Usuário
           *  toggla via botão de "card" no header da lista
           *  (showCards). */}
          {showPills && showCards && <ProfileCardStack />}

          {/* Stage 3 (t=15s): lista paginada — primeiros 20 user
           * rows + CTA "Exibir mais" floating quando há mais pra
           * carregar. */}
          {showList && (
            <section className={styles.userList}>
              {/* Header da lista com toggle do ProfileCardStack.
               *  Botão "card" mostra/oculta o stack vertical
               *  acima da lista. Inicia oculto per spec. */}
              {showPills && (
                <div className={styles.userListHeader}>
                  <motion.button
                    type="button"
                    className={`${styles.cardsToggle} ${showCards ? styles.cardsToggleActive : ''}`}
                    onClick={() => setShowCards((v) => !v)}
                    aria-label={showCards ? 'Ocultar cards' : 'Mostrar cards de perfis'}
                    aria-pressed={showCards}
                    whileTap={{ scale: 0.92 }}
                    whileHover={{ scale: 1.06 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {/* Stack of 2 cards (back card offset) */}
                      <rect x="6" y="3" width="13" height="17" rx="2" />
                      <rect x="3" y="6" width="13" height="17" rx="2" />
                    </svg>
                  </motion.button>
                </div>
              )}
              {snapshot.users
                .slice(0, visibleUsers)
                .map((u, i) => (
                  /* Stagger fade-in delay cap em 800ms (20 * 40ms)
                   * pra batches longos não terem cascade gigante.
                   * fsUserRowIn animação definida no CSS .userRow. */
                  <UserRow key={u.id} user={u} delayMs={Math.min(i * 40, 800)} />
                ))}

              {/* Infinite loading footer — sentinela + shimmer.
               *  IntersectionObserver no useEffect acima observa
               *  o sentinel e dispara um "fetch" de +20 a cada
               *  vez que entra no viewport, até atingir o cap
               *  (INFINITE_LOAD_CAP = 100). */}
              {visibleUsers <
                Math.min(snapshot.users.length, INFINITE_LOAD_CAP) && (
                <div
                  ref={sentinelRef}
                  className={styles.loadMore}
                  aria-live="polite"
                  aria-busy={loadingMore}
                >
                  {/* 3 skeleton rows shimmer enquanto carrega o
                   *  próximo lote — antecipa visualmente o que
                   *  vai aparecer. */}
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className={styles.loadMoreSkeleton}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: loadingMore ? 1 : 0.5 }}
                      transition={{
                        duration: 0.3,
                        delay: i * 0.08,
                      }}
                    >
                      <span className={styles.loadMoreAvatar} />
                      <span className={styles.loadMoreLine} />
                    </motion.div>
                  ))}
                  <motion.span
                    className={styles.loadMoreLabel}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {loadingMore ? 'Carregando mais fãs…' : 'Role para ver mais'}
                  </motion.span>
                </div>
              )}

              {/* End-of-list footer — cap atingido. */}
              {visibleUsers >=
                Math.min(snapshot.users.length, INFINITE_LOAD_CAP) && (
                <motion.div
                  className={styles.endOfList}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  Você viu todos os {INFINITE_LOAD_CAP} fãs em sintonia.
                </motion.div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function UserRow({ user, delayMs = 0 }: { user: FanverseSearchUser; delayMs?: number }) {
  return (
    <div
      className={styles.userRow}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      <span className={styles.userAvatar}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatarUrl} alt={user.name} />
      </span>
      <div className={styles.userInfo}>
        <span className={styles.userName}>{user.name}</span>
        <span className={styles.userMeta}>
          {user.role === 'super-fa' && (
            <span className={styles.userRole}>Super Fã</span>
          )}
          <span className={styles.userCity}>
            {user.city}{user.country ? `, ${user.country}` : ''}
          </span>
        </span>
      </div>
      <div className={styles.userActions}>
        {/* Barras "ouvindo agora" removidas per product feedback
         * "remova a animação de audio de todos os usuários". A user
         * list agora mostra só o coração no actions slot. */}
        <button
          type="button"
          className={`${styles.userHeart} ${user.isLiked ? styles.userHeartActive : ''}`}
          aria-label={user.isLiked ? 'Descurtir' : 'Curtir'}
        >
          <HeartIcon filled={user.isLiked} />
        </button>
      </div>
    </div>
  );
}
