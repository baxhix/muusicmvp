'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

/* Posições finais dos 8 avatares — agora puxadas pra extremidades
 * da viewport (vw/vh em vez de %) per product feedback "vão para
 * as extremidades da página".
 *
 * Os avatares fazem uma entrada cinemática: spawnam visualmente
 * no centro (50vw, 50vh — sobre o orbe) e voam pra cá usando a
 * CSS var --from-x/--from-y, dando a sensação de "surgem como se
 * fosse de dentro" do orbe (per product feedback). Depois entram
 * no loop fsRoam pra continuar flutuando ambiente. */
const FLOATING_POSITIONS = [
  { top:  '8vh', left:  '6vw' },
  { top:  '5vh', left: '86vw' },
  { top: '32vh', left:  '2vw' },
  { top: '28vh', left: '92vw' },
  { top: '66vh', left:  '4vw' },
  { top: '60vh', left: '90vw' },
  { top: '88vh', left: '18vw' },
  { top: '92vh', left: '76vw' },
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
      setPhraseIdx(0);
    }
  }, [open]);

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
    <div className={styles.overlay} role="dialog" aria-modal="true">
      {/* Backdrop blur — agora ocupa a tela inteira (sem modal card
       * em cima). Click fecha. */}
      <div
        className={styles.backdrop}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      {/* Camada de fundo (gradiente radial roxo/rosa) — fica abaixo
       * de tudo e ocupa toda a viewport. */}
      <div className={styles.bg} aria-hidden="true" />

      {/* Avatares flutuantes — camada fixa cobrindo a viewport
       * inteira. Eles permanecem visíveis durante todos os stages
       * (loading + reveal de headline + pills + lista), passando
       * POR CIMA do orbe (z-index 3) per product feedback.
       *
       * Entrada cinemática: cada avatar spawn visualmente no centro
       * (sobre o orbe) e voa pra sua posição final em --from-x/y.
       * Como top/left são em vw/vh, o offset é calc(50vw - left).
       * O fsRoam* só começa DEPOIS da entrada (delay = duração da
       * entrada + stagger) pra não conflitar com o transform. */}
      <div className={styles.floatingLayer} aria-hidden="true">
        {snapshot.topListeners.slice(0, 8).map((l, i) => {
          const pos = FLOATING_POSITIONS[i];
          /* stagger da entrada: cada avatar dispara 90ms depois do
           * anterior pra dar sensação de "saindo um a um do orbe". */
          const entryDelay = i * 0.09;
          /* delay do roam = 1.2s (duração entrada) + stagger pra
           * que cada um entre em órbita um pouco depois. */
          const roamDelay = 1.2 + i * 0.4;
          /* blink delay negativo pra cada um piscar em fase própria. */
          const blinkDelay = i * -2.4;
          return (
            <span
              key={l.id}
              className={styles.floatingAvatar}
              style={{
                top: pos.top,
                left: pos.left,
                /* Offset pra começar no centro da viewport. As units
                 * são vw/vh então o calc bate exato com left/top. */
                ['--from-x' as string]: `calc(50vw - ${pos.left})`,
                ['--from-y' as string]: `calc(50vh - ${pos.top})`,
                animationDelay: `${entryDelay}s, ${roamDelay}s, ${blinkDelay}s`,
              }}
              title={l.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.avatarUrl} alt={l.name} />
            </span>
          );
        })}
      </div>

      {/* Conteúdo central — scroll vertical, sem card. */}
      <div className={styles.scroll}>
        {/* Topbar — só back arrow. */}
        <div className={styles.topbar}>
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
        </div>

        {/* Hero — orbe central. Avatares já estão numa camada
         * separada (floatingLayer) cobrindo a tela toda. */}
        <div className={styles.hero}>
          <div className={styles.orb} aria-hidden="true">
            <FanverseCore />
          </div>
        </div>

        {/* Body — três stages, cada um renderiza condicionalmente. */}
        <div className={styles.body}>
          {/* Stage 1 (t=7s): headline centralizada, fonte menor,
           * rotacionando a cada 4s entre as 4 frases. */}
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
 * MatchStack — pilha de cards estilo Apple Wallet.
 *
 * Per product feedback "Os cards de match, ao invés de serem
 * scrolados lateralmente, crie uma interação como se fossem
 * empilhados, estilo microinterações apple".
 *
 * Comportamento:
 *   - 4 cards renderizados na mesma posição central.
 *   - O card do topo (depth 0) fica 100% visível, em escala 1.
 *   - Cards atrás (depth 1, 2, 3) ficam offsetados pra baixo,
 *     com scale menor e opacity reduzida, gerando o efeito de
 *     "deck de cartas".
 *   - Click no card do topo OU auto-rotate (4500ms) faz o array
 *     ciclar: o primeiro vai pro fim. Cada card transita
 *     suavemente entre profundidades via CSS transition com
 *     cubic-bezier overshoot.
 */
function MatchStack({ matches }: { matches: FanverseMatch[] }) {
  const [order, setOrder] = useState(matches);

  const cycle = () => {
    setOrder((arr) => [...arr.slice(1), arr[0]]);
  };

  /* Auto-rotação a cada 4.5s. Pausa quando aba não está em foco
   * (visibilitychange) pra não acumular setInterval. */
  useEffect(() => {
    const id = window.setInterval(cycle, 4500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={styles.matchStack}>
      {order.map((m, i) => (
        <button
          key={m.id}
          type="button"
          className={styles.matchCard}
          style={{
            ['--depth' as string]: i,
            zIndex: order.length - i,
            opacity: i <= 2 ? Math.max(0, 1 - i * 0.32) : 0,
            pointerEvents: i === 0 ? 'auto' : 'none',
          }}
          onClick={i === 0 ? cycle : undefined}
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
      ))}
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
