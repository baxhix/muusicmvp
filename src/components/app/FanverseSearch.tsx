'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import FanverseCore from '@/components/animations/FanverseCore';
import {
  FANVERSE_SEARCH_SNAPSHOT,
  type FanverseSearchUser,
  type FanverseMatch,
} from '@/lib/fanverseSearchMocks';
import styles from './FanverseSearch.module.css';

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

/* Posições finais dos 11 avatares.
 *
 * Per product feedback "Os usuários flutuantes se afastaram muito
 * do orbe, deixe eles mais próximos, ora passam por cima do orbe.
 * Inclua mais 3 usuários flutuantes para dar volume." — posições
 * recolhidas pro entorno do orbe (era 2-92vw/vh, agora 22-78vw/vh
 * em desktop; mobile fica ainda mais perto via override no CSS).
 * O orbe ocupa ~286px no centro, então 22-78vw cerca ele com folga
 * mas faz com que os paths fsRoam cruzem o orbe constantemente.
 *
 * Total 11 posições (era 8). 3 anéis radiais:
 *   - anel interno  (4 avatares perto do orbe, top/bottom + sides)
 *   - anel médio    (4 avatares meio-distância, diagonais)
 *   - anel externo  (3 avatares mais afastados, cantos)
 *
 * Entrada cinemática: cada avatar spawn no centro (50vw, 50vh) e
 * voa pra cá via CSS vars --from-x/--from-y. */
const FLOATING_POSITIONS = [
  /* Anel interno — abraça o orbe (passam frequentemente por cima) */
  { top: '32vh', left: '28vw' },
  { top: '30vh', left: '70vw' },
  { top: '58vh', left: '24vw' },
  { top: '60vh', left: '72vw' },
  /* Anel médio */
  { top: '18vh', left: '40vw' },
  { top: '20vh', left: '60vw' },
  { top: '72vh', left: '38vw' },
  { top: '74vh', left: '62vw' },
  /* Anel externo (3 pra dar volume sem afastar muito) */
  { top: '12vh', left: '20vw' },
  { top: '14vh', left: '78vw' },
  { top: '82vh', left: '50vw' },
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

/* Ondas de aparecimento dos avatares.
 *
 * Per product feedback "Primeiro aparece apenas o orbe; Na sequencia
 * aparece 1 usuário, seguido de mais dois com leve diferença de
 * tempo; depois mais 4 e assim por diante, para parecer algo bem
 * aleatório e surpresa gradativa."
 *
 * Cada entrada é o timestamp (ms a partir da abertura) em que o
 * avatar de índice N deve aparecer. Pattern: 1 → +2 (stagger 300ms)
 * → +4 (stagger 200ms) → +4 (stagger 200ms) = 11 total. */
const AVATAR_WAVE_TIMINGS: number[] = [
  1600,                          // 1 (wave 1)
  2900, 3200,                    // 2,3 (wave 2 — leve diferença entre eles)
  4400, 4600, 4800, 5050,        // 4,5,6,7 (wave 3 — stagger 200ms)
  6200, 6420, 6650, 6900,        // 8,9,10,11 (wave 4)
];

/* Frases pra typewriter da loading copy.
 *
 * Per product feedback "Após apagar, coloque: 'Procurando no Brasil',
 * depois 'Procurando pela Europa' e assim por diante. deixe essa
 * frase acima do orbe."
 *
 * Cada frase é tipada, segurada, e apagada. Depois passa pra próxima
 * num loop infinito enquanto o overlay está aberto. Primeira é a
 * geral "Analisando..." e depois rotaciona pelas regiões. */
const ANALYZING_PHRASES: string[] = [
  'Analisando dados do mundo todo...',
  'Procurando no Brasil',
  'Procurando pela Europa',
  'Procurando na América do Norte',
  'Procurando na Ásia',
  'Procurando na Oceania',
  'Procurando na África',
];

/* Velocidades do typewriter (ms). Tipar é mais lento que apagar pra
 * dar peso a cada palavra entrando. */
const TYPE_MS = 60;
const ERASE_MS = 30;
const HOLD_MS = 1800;
const PAUSE_BEFORE_NEXT_MS = 350;

export default function FanverseSearch() {
  const [open, setOpen] = useState(false);
  /* 3 stages de reveal — cada um aparece em sequência:
   *   t=7s  showHeadline → headline centralizada
   *   t=11s showPills    → carrossel de match pills
   *   t=15s showList     → lista de usuários completa
   * Antes disso, só orbe + avatares flutuantes (efeito "carregando"). */
  const [showHeadline, setShowHeadline] = useState(false);
  const [showPills, setShowPills] = useState(false);
  const [showList, setShowList] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(0);
  /* Quantos avatares já apareceram. Começa em 0 (só orbe) e cresce
   * em ondas conforme AVATAR_WAVE_TIMINGS — wave 1 (1 user), wave 2
   * (+2), wave 3 (+4), wave 4 (+4) = 11 totais. */
  const [avatarsShown, setAvatarsShown] = useState(0);
  /* Typewriter da copy "Analisando..." */
  const [typedText, setTypedText] = useState('');
  const [typeIdx, setTypeIdx] = useState(0);
  const [typePhase, setTypePhase] = useState<'typing' | 'holding' | 'erasing' | 'pausing'>('typing');
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

  /* Escape fecha; reveal staged em 3 etapas. */
  useEffect(() => {
    if (!open) return;
    const tH = window.setTimeout(() => setShowHeadline(true), STAGE_HEADLINE_MS);
    const tP = window.setTimeout(() => setShowPills(true),    STAGE_PILLS_MS);
    const tL = window.setTimeout(() => setShowList(true),     STAGE_LIST_MS);
    /* Schedule cada avatar pra aparecer no seu timestamp. Mantém
     * todos os ids dos timeouts pra cancelar no cleanup. */
    const avatarTimers = AVATAR_WAVE_TIMINGS.map((ms, i) =>
      window.setTimeout(() => setAvatarsShown(i + 1), ms),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(tH);
      window.clearTimeout(tP);
      window.clearTimeout(tL);
      avatarTimers.forEach((id) => window.clearTimeout(id));
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Reset ao fechar (anima de novo na próxima abertura). */
  useEffect(() => {
    if (!open) {
      setShowHeadline(false);
      setShowPills(false);
      setShowList(false);
      setPhraseIdx(0);
      setAvatarsShown(0);
      setTypedText('');
      setTypeIdx(0);
      setTypePhase('typing');
      setScrolled(false);
    }
  }, [open]);

  /* Typewriter loop: 'typing' adiciona um char por vez até o fim
   * da frase, vai pra 'holding' (segura 1.8s), depois 'erasing'
   * tira um char por vez até zerar, depois 'pausing' (0.35s) e
   * 'typing' novamente com a próxima frase. */
  useEffect(() => {
    if (!open) return;
    const phrase = ANALYZING_PHRASES[typeIdx];
    if (typePhase === 'typing') {
      if (typedText.length < phrase.length) {
        const id = window.setTimeout(() => setTypedText(phrase.slice(0, typedText.length + 1)), TYPE_MS);
        return () => window.clearTimeout(id);
      } else {
        const id = window.setTimeout(() => setTypePhase('holding'), 0);
        return () => window.clearTimeout(id);
      }
    }
    if (typePhase === 'holding') {
      const id = window.setTimeout(() => setTypePhase('erasing'), HOLD_MS);
      return () => window.clearTimeout(id);
    }
    if (typePhase === 'erasing') {
      if (typedText.length > 0) {
        const id = window.setTimeout(() => setTypedText(typedText.slice(0, -1)), ERASE_MS);
        return () => window.clearTimeout(id);
      } else {
        const id = window.setTimeout(() => setTypePhase('pausing'), 0);
        return () => window.clearTimeout(id);
      }
    }
    if (typePhase === 'pausing') {
      const id = window.setTimeout(() => {
        setTypeIdx((i) => (i + 1) % ANALYZING_PHRASES.length);
        setTypePhase('typing');
      }, PAUSE_BEFORE_NEXT_MS);
      return () => window.clearTimeout(id);
    }
  }, [open, typedText, typeIdx, typePhase]);

  /* Scroll listener — quando scrollTop ultrapassa 60px, ativa o
   * estado "scrolled" que diminui o orbe via transform: scale. */
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrolled(el.scrollTop > 60);
  };

  const snapshot = FANVERSE_SEARCH_SNAPSHOT;

  /* 4 frases rotacionando a cada 4s. Per product feedback "nas
   * frases quebre a linha em: Ana Castela com você / Mesma
   * música / Mesmo álbum" — `<br />` força o destaque branco
   * bold cair pra segunda linha em cada caso. */
  type Phrase = {
    key: string;
    render: ReactNode;
  };
  const PHRASES: Phrase[] = useMemo(() => [
    {
      key: 'all',
      render: (
        <>
          <strong>{snapshot.peopleCount.toLocaleString('pt-BR')}</strong>{' '}
          <span className={styles.headlineMuted}>pessoas curtindo</span>
          <br />
          <strong>Ana Castela com você</strong>
        </>
      ),
    },
    {
      key: 'song',
      render: (
        <>
          <strong>{snapshot.sameSongCount.toLocaleString('pt-BR')}</strong>{' '}
          <span className={styles.headlineMuted}>pessoas ouvindo a</span>
          <br />
          <strong>Mesma música</strong>
        </>
      ),
    },
    {
      key: 'album',
      render: (
        <>
          <strong>{snapshot.sameAlbumCount.toLocaleString('pt-BR')}</strong>{' '}
          <span className={styles.headlineMuted}>pessoas ouvindo o</span>
          <br />
          <strong>Mesmo álbum</strong>
        </>
      ),
    },
    {
      key: 'countries',
      render: (
        <>
          <strong>{snapshot.countriesCount}</strong>{' '}
          <span className={styles.headlineMuted}>países conectados</span>{' '}
          <strong>agora</strong>
        </>
      ),
    },
  ], [snapshot]);

  /* Rotaciona a cada 4s — só começa depois que a headline aparece. */
  useEffect(() => {
    if (!open || !showHeadline) return;
    const id = window.setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, 4000);
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

      {/* Avatares flutuantes — camada fixa cobrindo a viewport.
       *
       * Aparecem em ondas (1 → +2 → +4 → +4 = 11) controladas por
       * `avatarsShown` (per product feedback). Cada avatar começa
       * mounted com display:none até seu índice ser < avatarsShown,
       * quando ganha o style.floatingAvatar (que dispara fsAvatarIn). */}
      <div className={styles.floatingLayer} aria-hidden="true">
        {snapshot.topListeners.slice(0, FLOATING_POSITIONS.length).map((l, i) => {
          const pos = FLOATING_POSITIONS[i];
          const isShown = i < avatarsShown;
          /* delay do roam = 1.2s (duração entrada) + stagger leve.
           * blink delay negativo pra cada um piscar em fase própria. */
          const roamDelay = 1.2 + i * 0.35;
          const blinkDelay = i * -2.4;
          return (
            <span
              key={l.id}
              className={`${styles.floatingAvatar} ${isShown ? styles.floatingAvatarShown : ''}`}
              style={{
                top: pos.top,
                left: pos.left,
                ['--from-x' as string]: `calc(50vw - ${pos.left})`,
                ['--from-y' as string]: `calc(50vh - ${pos.top})`,
                animationDelay: `0ms, ${roamDelay}s, ${blinkDelay}s`,
              }}
              title={l.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.avatarUrl} alt={l.name} />
            </span>
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
          <span className={styles.analyzingText}>{typedText}</span>
          <span className={styles.analyzingCursor} aria-hidden="true" />
        </div>
        <div className={styles.orb} aria-hidden="true">
          <FanverseCore />
        </div>
      </div>

      {/* Scroll vertical do conteúdo principal — só body (headline,
       * pills, list). Topbar e orbe estão fora do scroll (fixos). */}
      <div className={styles.scroll} ref={scrollRef} onScroll={handleScroll}>
        <div className={styles.body}>
          {/* Stage 1 (t=7s): headline centralizada com fonte menor,
           * rotacionando a cada 4s entre as 4 frases. A loading copy
           * "Analisando..." agora vive no .fixedHeader (acima do orbe). */}
          {showHeadline && (
            <h2 className={styles.headline} key={currentPhrase.key}>
              {currentPhrase.render}
            </h2>
          )}

          {/* Stage 2 (t=11s): match cards em pilha (estilo Apple
           * Wallet). Click no card do topo OU auto-rotate cicla. */}
          {showPills && <MatchStack matches={snapshot.matches} />}

          {/* Stage 3 (t=15s): lista completa de usuários. */}
          {showList && (
            <section className={styles.userList}>
              {snapshot.users.map((u) => <UserRow key={u.id} user={u} />)}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * MatchStack — pilha de cards estilo Apple Wallet, com:
 *   1. Reveal staged — um card aparece a cada 3s (per product
 *      feedback "Faça com que apareça um card por vez a cada 3s").
 *      Card novo entra do topo do stack escalando do centro.
 *   2. Quando todos os cards já apareceram, entra em ciclo de
 *      auto-rotação (o do topo afunda pra trás a cada 4.5s).
 *   3. No mobile, swipe horizontal no card do topo faz ele
 *      "sair" do stack (per product feedback "No mobile, ao
 *      arrastar o primeiro desaparece, ficando o que está por
 *      trás"). Click no topo também cicla (UX desktop).
 */
function MatchStack({ matches }: { matches: FanverseMatch[] }) {
  /* order: ordem atual dos cards no stack (índice 0 = topo). */
  const [order, setOrder] = useState(matches);
  /* visibleCount: quantos cards já apareceram. Começa em 1; ganha
   * +1 a cada 3s até atingir matches.length, e depois para. */
  const [visibleCount, setVisibleCount] = useState(1);
  /* dragOffset: deslocamento horizontal do card do topo durante o
   * swipe (mobile). Reset pra 0 quando o swipe termina (ou completa
   * o threshold e o card vai pra trás). */
  const [dragOffset, setDragOffset] = useState(0);
  const dragStateRef = useRef<{ startX: number; pointerId: number } | null>(null);

  /* Cycle = manda o card do topo pro fim do array. */
  const cycle = () => {
    setOrder((arr) => [...arr.slice(1), arr[0]]);
  };

  /* Phase 1: reveal staged — 1 card a cada 3s até preencher.
   * Phase 2 (depois): rotação automática a cada 4.5s.
   *
   * Os dois ciclos compartilham o mesmo "tick" via setInterval(3s);
   * uma vez tudo visível, mudamos o tick pra 4.5s. Implementado em
   * 2 effects pra clareza — cada um cancela o outro via deps. */
  useEffect(() => {
    if (visibleCount >= matches.length) return;
    const id = window.setTimeout(() => {
      setVisibleCount((n) => Math.min(n + 1, matches.length));
    }, 3000);
    return () => window.clearTimeout(id);
  }, [visibleCount, matches.length]);

  useEffect(() => {
    if (visibleCount < matches.length) return;
    const id = window.setInterval(cycle, 4500);
    return () => window.clearInterval(id);
  }, [visibleCount, matches.length]);

  /* Swipe handlers — usam Pointer Events pra cobrir touch + mouse
   * com a mesma API. Só atua no card do topo (i===0) e quando o
   * deslocamento absoluto passa de 80px, considera "descartado" e
   * cicla; senão volta pra origem com transition (sem state). */
  const onPointerDown = (e: React.PointerEvent) => {
    dragStateRef.current = { startX: e.clientX, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return;
    setDragOffset(e.clientX - dragStateRef.current.startX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return;
    const offset = e.clientX - dragStateRef.current.startX;
    dragStateRef.current = null;
    if (Math.abs(offset) > 80) {
      /* Anima o card saindo da tela na direção do swipe antes de
       * ciclar (visualmente "desaparece"). Setamos offset grande
       * pra animar, e depois de 280ms cicla + reseta. */
      setDragOffset(offset > 0 ? 600 : -600);
      window.setTimeout(() => {
        cycle();
        setDragOffset(0);
      }, 280);
    } else {
      /* Volta suave pro lugar. */
      setDragOffset(0);
    }
  };

  return (
    <div className={styles.matchStack}>
      {order.map((m, i) => {
        /* Cards além do visibleCount-1 ficam mounted mas opacity 0,
         * pra não pipocarem na entrada — quando entram no stack
         * (i < visibleCount), animam scale+opacity de uma vez. */
        const isVisible = i < visibleCount;
        const isTop = i === 0;
        return (
          <button
            key={m.id}
            type="button"
            className={`${styles.matchCard} ${isTop && dragOffset !== 0 ? styles.matchCardDragging : ''}`}
            style={{
              ['--depth' as string]: i,
              ['--drag-x' as string]: `${isTop ? dragOffset : 0}px`,
              zIndex: order.length - i,
              opacity: isVisible ? (i <= 2 ? Math.max(0, 1 - i * 0.32) : 0) : 0,
              pointerEvents: isTop && isVisible ? 'auto' : 'none',
            }}
            onClick={isTop && dragOffset === 0 ? cycle : undefined}
            onPointerDown={isTop ? onPointerDown : undefined}
            onPointerMove={isTop ? onPointerMove : undefined}
            onPointerUp={isTop ? onPointerUp : undefined}
            onPointerCancel={isTop ? onPointerUp : undefined}
            aria-label={`Match com ${m.name}`}
          >
            <span className={styles.matchAvatar}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.avatarUrl} alt={m.name} />
            </span>
            <span className={styles.matchCopy}>
              <span className={styles.matchCopyBold}>Você e {m.name}</span>{' '}
              <span className={styles.matchCopyMuted}>{m.suffix}</span>
            </span>
            <span className={styles.matchHeart} aria-hidden="true">
              <HeartIcon filled />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function UserRow({ user }: { user: FanverseSearchUser }) {
  return (
    <div className={styles.userRow}>
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
