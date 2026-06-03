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

/* Posições semi-aleatórias dos 12 avatares orbitando o orbe.
 * Calculadas pra parecerem inorgânicas (sem grid, sem círculo
 * perfeito) — top/left em %, transform translate(-50%, -50%)
 * centra cada avatar no ponto. As 4 primeiras posições ficam
 * mais perto do orbe (raio menor); as 8 últimas espalham pelas
 * bordas da hero section. */
const FLOATING_POSITIONS = [
  { top: '12%', left: '22%' },
  { top: '8%',  left: '68%' },
  { top: '20%', left: '88%' },
  { top: '30%', left: '6%' },
  { top: '48%', left: '14%' },
  { top: '52%', left: '92%' },
  { top: '72%', left: '20%' },
  { top: '78%', left: '74%' },
  { top: '5%',  left: '42%' },
  { top: '38%', left: '95%' },
  { top: '88%', left: '50%' },
  { top: '64%', left: '52%' },
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

  /* 4 frases rotacionando a cada 4s. Cada uma traz um render
   * (com bold/regular mix) + filter pra user list abaixo. */
  type Phrase = {
    key: string;
    render: ReactNode;
    filter: (u: FanverseSearchUser) => boolean;
  };
  const PHRASES: Phrase[] = useMemo(() => [
    {
      key: 'all',
      render: (
        <>
          <strong>{snapshot.peopleCount.toLocaleString('pt-BR')}</strong>{' '}
          <span className={styles.headlineMuted}>pessoas curtindo</span>{' '}
          <strong>Ana Castela</strong>{' '}
          <span className={styles.headlineMuted}>com você!</span>
        </>
      ),
      filter: () => true,
    },
    {
      key: 'song',
      render: (
        <>
          <strong>{snapshot.sameSongCount.toLocaleString('pt-BR')}</strong>{' '}
          <span className={styles.headlineMuted}>pessoas ouvindo a</span>{' '}
          <strong>mesma música</strong>
        </>
      ),
      filter: (u: FanverseSearchUser) => u.isListening,
    },
    {
      key: 'album',
      render: (
        <>
          <strong>{snapshot.sameAlbumCount.toLocaleString('pt-BR')}</strong>{' '}
          <span className={styles.headlineMuted}>pessoas ouvindo o</span>{' '}
          <strong>mesmo álbum</strong>
        </>
      ),
      filter: (u: FanverseSearchUser) => u.role !== 'curioso',
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
      filter: () => true,
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
  const filteredUsers = useMemo(
    () => snapshot.users.filter(currentPhrase.filter),
    [snapshot.users, currentPhrase],
  );

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.bg} aria-hidden="true" />

      {/* Topbar */}
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
        <div className={styles.artistThumb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ana-castela-fanverse-desktop.jpg"
            alt="Ana Castela"
            className={styles.artistThumbImg}
          />
        </div>
      </div>

      {/* Hero — orbe + avatares orbitando + texto loading */}
      <div className={styles.hero}>
        {/* Floating avatars — posições semi-aleatórias ao redor do
         * orbe. Aparecem com fade staggered (animation-delay
         * incremental). */}
        {snapshot.topListeners.slice(0, 12).map((l, i) => (
          <span
            key={l.id}
            className={styles.floatingAvatar}
            style={{
              top: FLOATING_POSITIONS[i].top,
              left: FLOATING_POSITIONS[i].left,
              animationDelay: `${i * 0.08}s`,
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
        <div className={styles.loadingText}>
          Analisando atividade do mundo
          <span className={styles.dots} aria-hidden="true">
            <span>.</span><span>.</span><span>.</span>
          </span>
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

        {/* User list — muda com phraseIdx */}
        <section className={styles.userList} key={currentPhrase.key + ':list'}>
          {filteredUsers.length === 0 ? (
            <p className={styles.emptyState}>Sem usuários nessa categoria agora.</p>
          ) : (
            filteredUsers.map((u) => <UserRow key={u.id} user={u} />)
          )}
        </section>
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
        {user.isListening && (
          <span className={styles.userBars} aria-label="ouvindo agora">
            <i></i><i></i><i></i><i></i>
          </span>
        )}
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
