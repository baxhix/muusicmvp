'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import FanverseCore from '@/components/animations/FanverseCore';
import {
  FANVERSE_SEARCH_SNAPSHOT,
  type FanverseSearchUser,
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

/* Posições semi-aleatórias dos 8 avatares flutuantes.
 *
 * Per product feedback "Remova o box, deixe que tudo aconteça em
 * um ambiente só com o fundo com blur e os usuários flutuem sem
 * desaparecer no box" — os avatares passaram a ser uma camada
 * fixa cobrindo a viewport inteira (não mais constrained ao .hero).
 * Os % aqui são relativos à tela toda, então alguns ficam mais
 * pertos das bordas, outros sobre a área central do orbe.
 *
 * As 8 posições continuam sendo o ponto de partida — o keyframe
 * fsRoam* roda eles em loops largos a partir daí cruzando o orbe. */
const FLOATING_POSITIONS = [
  { top: '12%', left: '15%' },
  { top: '8%',  left: '78%' },
  { top: '38%', left: '5%'  },
  { top: '32%', left: '90%' },
  { top: '68%', left: '10%' },
  { top: '62%', left: '85%' },
  { top: '85%', left: '28%' },
  { top: '88%', left: '72%' },
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

      {/* Avatares flutuantes — agora numa camada própria fixa
       * cobrindo a viewport inteira. Eles permanecem visíveis
       * durante todos os stages (loading + reveal de headline +
       * pills + lista), passando por cima ou por trás do conteúdo
       * conforme z-index. Per product feedback "os usuários
       * flutuem sem desaparecer no box". */}
      <div className={styles.floatingLayer} aria-hidden="true">
        {snapshot.topListeners.slice(0, 8).map((l, i) => (
          <span
            key={l.id}
            className={styles.floatingAvatar}
            style={{
              top: FLOATING_POSITIONS[i].top,
              left: FLOATING_POSITIONS[i].left,
              /* 3 animation-delays:
               *   1. fsAvatarIn entry: stagger por i (0.10s gap)
               *   2. fsRoam* path: negative pra entrar em fase
               *   3. fsBlink fade in/out: -2s por i (gap maior) */
              animationDelay: `${i * 0.10}s, ${i * -1.7}s, ${i * -2.4}s`,
            }}
            title={l.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.avatarUrl} alt={l.name} />
          </span>
        ))}
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

          {/* Stage 2 (t=11s): match pills em carrossel horizontal. */}
          {showPills && (
            <div className={styles.matchPills}>
              {snapshot.matches.map((m) => (
                <div key={m.id} className={styles.matchPill}>
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
                </div>
              ))}
            </div>
          )}

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
