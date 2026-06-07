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
   * Orbe ocupa ~40-60vw × 22-48vh; avatares no anel imediato
   * (28-72vw × 16-58vh) — todos a no máximo ~22vw de distância
   * do centro. */
  { top: '20vh', left: '32vw' },
  { top: '22vh', left: '68vw' },
  { top: '18vh', left: '50vw' },
  { top: '40vh', left: '24vw' },
  { top: '42vh', left: '76vw' },
  { top: '30vh', left: '20vw' },
  { top: '32vh', left: '80vw' },
  { top: '56vh', left: '34vw' },
  { top: '58vh', left: '66vw' },
  { top: '50vh', left: '28vw' },
  { top: '52vh', left: '72vw' },
];

/* Ordem de revelação por PROXIMIDADE ao orbe (~50vw, 35vh).
 *
 * Per product feedback "os do começo mais próximos ao orbe":
 * computamos distância euclidiana de cada FLOATING_POSITIONS[i]
 * ao centro do orbe e ordenamos crescente. O primeiro a aparecer
 * (idx 2 = 50vw/18vh) é o que está mais perto verticalmente; os
 * de cantos extremos (idx 5, 6) aparecem por último. */
const AVATAR_REVEAL_ORDER = [2, 1, 0, 7, 3, 9, 4, 10, 8, 6, 5];

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

/* Copy do "Analisando" — agora com fade in/out via CSS (sem
 * typewriter). Texto completo fica sempre montado; o efeito fade é
 * a animação fsAnalyzingFade no .analyzing. */
const ANALYZING_PHRASE = 'Analisando atividade musical...';

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
  /* Avatares aparecem em sequência (mais próximos primeiro), começando
   * em t=3s. avatarsShown conta quantos posições da AVATAR_REVEAL_ORDER
   * já estão visíveis (de 0 a 11). */
  const [avatarsShown, setAvatarsShown] = useState(0);
  /* Paginação da lista — começa exibindo 20 nomes; cada clique no
   * CTA "Exibir mais" adiciona +20 até cobrir todos os users. */
  const [visibleUsers, setVisibleUsers] = useState(20);
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
    /* Avatares revelam um a um a partir de t=3s, em intervalos de
     * 350ms. Ordem = AVATAR_REVEAL_ORDER (mais próximos primeiro). */
    const avatarTimers = AVATAR_REVEAL_ORDER.map((_, pos) =>
      window.setTimeout(
        () => setAvatarsShown((n) => Math.max(n, pos + 1)),
        AVATAR_REVEAL_START_MS + pos * AVATAR_REVEAL_STEP_MS,
      ),
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
      setVisibleUsers(20);
      setScrolled(false);
    }
  }, [open]);

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
       * Aparecem um a um a partir de t=3s, na ordem AVATAR_REVEAL_ORDER
       * (mais próximos do orbe primeiro). isShown = avatarsShown já
       * incluiu a posição deste avatar na ordem de reveal. */}
      <div className={styles.floatingLayer} aria-hidden="true">
        {snapshot.topListeners.slice(0, FLOATING_POSITIONS.length).map((l, i) => {
          const pos = FLOATING_POSITIONS[i];
          const revealPos = AVATAR_REVEAL_ORDER.indexOf(i);
          const isShown = revealPos >= 0 && revealPos < avatarsShown;
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
          <span className={styles.analyzingText}>{ANALYZING_PHRASE}</span>
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

          {/* Stage 3 (t=15s): lista paginada — primeiros 20 user
           * rows + CTA "Exibir mais" floating quando há mais pra
           * carregar. */}
          {showList && (
            <section className={styles.userList}>
              {snapshot.users
                .slice(0, visibleUsers)
                .map((u, i) => (
                  /* Stagger fade-in delay cap em 800ms (20 * 40ms)
                   * pra batches longos não terem cascade gigante.
                   * fsUserRowIn animação definida no CSS .userRow. */
                  <UserRow key={u.id} user={u} delayMs={Math.min(i * 40, 800)} />
                ))}
            </section>
          )}
        </div>
      </div>

      {/* CTA flutuante "Exibir mais" — fixed bottom, totalmente
       * arredondado. Aparece só quando a lista está visível e há
       * mais users disponíveis. Cada clique soma +20. */}
      {showList && visibleUsers < snapshot.users.length && (
        <button
          type="button"
          className={styles.showMoreBtn}
          onClick={() =>
            setVisibleUsers((n) =>
              Math.min(n + 20, snapshot.users.length),
            )
          }
        >
          Exibir mais
        </button>
      )}
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

  /* Cycle = manda o card do topo (visualmente o último visível,
   * pois agora o "newest" fica na frente) pra posição 0 do array.
   * Assim o penúltimo card sobe pra ser o novo topo do stack e a
   * sensação é de "o card foi pro fim da pilha". */
  const cycle = () => {
    setOrder((arr) => {
      if (arr.length < 2) return arr;
      const topIdx = arr.length - 1;
      const top = arr[topIdx];
      return [top, ...arr.slice(0, topIdx)];
    });
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

  /* Auto-rotate desativado — com o stack vertical (cada card num
   * lugar próprio), rotacionar a ordem sozinho a cada 4.5s ficaria
   * visualmente confuso (cards "saltando" pra reorganizar). Cycle
   * continua disponível via click/swipe no card do topo. */

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
        /* Depth-stack "newest on top": o último card visível (maior
         * índice entre os revelados) fica na frente (depth 0); os
         * anteriores aparecem ATRÁS com peek descendente.
         * depth = (visibleCount - 1) - i */
        const isVisible = i < visibleCount;
        const depth = isVisible ? (visibleCount - 1) - i : 99;
        const isTop = isVisible && i === visibleCount - 1;
        return (
          <button
            key={m.id}
            type="button"
            className={`${styles.matchCard} ${isTop && dragOffset !== 0 ? styles.matchCardDragging : ''}`}
            style={{
              ['--depth' as string]: depth,
              ['--drag-x' as string]: `${isTop ? dragOffset : 0}px`,
              /* zIndex: newest (depth 0) tem o maior valor pra
               * realmente ficar VISUALMENTE em cima dos anteriores. */
              zIndex: 100 - depth,
              opacity: isVisible ? (depth <= 2 ? Math.max(0.3, 1 - depth * 0.28) : 0) : 0,
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
