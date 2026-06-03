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

/* Posições semi-aleatórias dos 8 avatares orbitando o orbe.
 * Per product feedback "Diminua para 8 avatares" — reduzido de
 * 12 → 8 pra dar mais respiro ao orbe + cada um com path de
 * movimento longo (definido nas keyframes do CSS), evitando o
 * micro-tremor que o array anterior dava. As posições aqui são
 * só o ponto de partida; o keyframe fsFloatRoam roda eles em
 * loops largos a partir daí. */
const FLOATING_POSITIONS = [
  { top: '14%', left: '20%' },
  { top: '10%', left: '72%' },
  { top: '32%', left: '6%'  },
  { top: '28%', left: '92%' },
  { top: '58%', left: '12%' },
  { top: '52%', left: '88%' },
  { top: '78%', left: '32%' },
  { top: '82%', left: '70%' },
];

export default function FanverseSearch() {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(0);

  /* Listener global pra abrir. */
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('app:open-fanverse-search', handler);
    return () => window.removeEventListener('app:open-fanverse-search', handler);
  }, []);

  /* Escape fecha; reveal staggered ao abrir. */
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setRevealed(true), 700);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Reset ao fechar (anima de novo na próxima abertura). */
  useEffect(() => {
    if (!open) {
      setRevealed(false);
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

  /* Rotaciona a cada 4s. */
  useEffect(() => {
    if (!open || !revealed) return;
    const id = window.setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [open, revealed, PHRASES.length]);

  const currentPhrase = PHRASES[phraseIdx];

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      {/* Backdrop blur — visível no desktop quando o overlay vira
       * modal centrado; mobile fica edge-to-edge sem blur. Click
       * fecha. */}
      <div
        className={styles.backdrop}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      {/* Modal — wrapper que recebe radius + max-width no desktop
       * e ocupa full-screen no mobile. */}
      <div className={styles.modal}>
        <div className={styles.bg} aria-hidden="true" />

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

      {/* Hero — orbe + avatares orbitando.
       *
       *  Per product feedback "Remova Analisando atividade do
       *  mundo" — texto loading + dots foram removidos; o orbe
       *  + os avatares orbitando já comunicam o aspecto de
       *  "atividade" sem precisar de copy.
       *
       *  Avatares passam por cima do orbe per "Os avatares
       *  flutuantes podem e devem passar por cima do orbe" — o
       *  z-index dos avatares (3) já era maior que o do orbe (1),
       *  e os paths agora têm amplitude maior pra que de fato
       *  cruzem o centro visualmente.
       *
       *  Velocidade aumentada e ciclo de fade-out/fade-in
       *  staggered pra "aparecem novamente" sem todos sumindo
       *  juntos — tudo gerenciado nos keyframes do CSS. */}
      <div className={styles.hero}>
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
               *   3. fsBlink fade in/out: -2s por i (gap maior)
               *      pra cada avatar aparecer/sumir em momento
               *      diferente */
              animationDelay: `${i * 0.10}s, ${i * -1.7}s, ${i * -2.4}s`,
            }}
            title={l.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.avatarUrl} alt={l.name} />
          </span>
        ))}

        <div className={styles.orb} aria-hidden="true">
          <FanverseCore />
        </div>
      </div>

      {/* Conteúdo abaixo — fade-in staggered */}
      <div className={`${styles.body} ${revealed ? styles.bodyRevealed : ''}`}>
        {/* Headline rotativo (24px, left-aligned, bold+gray mix) */}
        <h2 className={styles.headline} key={currentPhrase.key}>
          {currentPhrase.render}
        </h2>

        {/* Match pills — horizontal scroll, 4px gradient border */}
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

        {/* User list — fixa per product feedback "Ao mudar a frase,
         * não mude a lista de usuários. Deixe a fixa". Não tem mais
         * remount via key — todos os mocked users sempre renderizam. */}
        <section className={styles.userList}>
          {snapshot.users.map((u) => <UserRow key={u.id} user={u} />)}
        </section>
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
