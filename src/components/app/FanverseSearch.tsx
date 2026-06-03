'use client';

import { useEffect, useMemo, useState } from 'react';
import FanverseCore from '@/components/animations/FanverseCore';
import {
  FANVERSE_SEARCH_SNAPSHOT,
  ROLE_LABEL,
  type FanverseSearchUser,
} from '@/lib/fanverseSearchMocks';
import styles from './FanverseSearch.module.css';

/**
 * FanverseSearch — overlay full-screen disparado pelo clique no
 * orbe FanverseCore (header do ArtistBox / MobileFanverseSheet /
 * MobileHomeChrome).
 *
 * Layout:
 *   1. Header: back-arrow + thumb pequeno da Ana Castela (top-right)
 *   2. Hero loading: orbe grande rotacionando + "Analisando
 *      atividade do mundo..." (sempre presente; loading visual)
 *   3. Cluster com os 12 maiores ouvintes + frase "X pessoas
 *      curtindo Ana Castela com você"
 *   4. Match pill (carrossel rolando manualmente — só visual)
 *   5. Stats em 4 chips/cards (mesma música, mesmo álbum, países,
 *      pessoas)
 *   6. Tabs decorativas (Música / Super Fãs / Álbum / Artistas)
 *      com contadores
 *   7. Lista navegável de usuários (avatar + nome + cidade + bars
 *      animadas + coração)
 *
 * Mount-pattern: ouve `app:open-fanverse-search` global; o orbe
 * dispatcha o event, qualquer surface pode disparar. Auto-close
 * via Escape ou clique no back.
 *
 * Dados: 100% mocados — `lib/fanverseSearchMocks.ts`. Quando o
 * backend entregar os endpoints reais, trocar o useState inicial
 * por um hook (useFanverseSnapshot ou similar).
 */
export default function FanverseSearch() {
  const [open, setOpen] = useState(false);
  /* "Analisando..." inicia em loading e nunca sai dele — é puro
   * estado visual (loading aspect contínuo) per product feedback
   * "com um aspecto de loading". Stats e listagem entram com
   * fade-in escalonado pra dar sensação de "carregando dados". */
  const [revealed, setRevealed] = useState(false);
  const [activeTab, setActiveTab] = useState<'musica' | 'superfas' | 'album' | 'artistas'>('musica');

  /* Listener global pra abrir. Qualquer surface (ArtistBox,
   * MobileFanverseSheet, MobileHomeChrome) dispatcha o event sem
   * precisar acoplar com shell context. */
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener('app:open-fanverse-search', open);
    return () => window.removeEventListener('app:open-fanverse-search', open);
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

  /* Reset reveal quando fechar pra reanimação na próxima abertura. */
  useEffect(() => {
    if (!open) setRevealed(false);
  }, [open]);

  const snapshot = FANVERSE_SEARCH_SNAPSHOT;

  /* Match em rotação automática a cada 4s, simulando o carrossel
   * de afinidade. Decorativo — usuário pode ignorar. */
  const [matchIdx, setMatchIdx] = useState(0);
  useEffect(() => {
    if (!open || !revealed) return;
    const id = window.setInterval(() => {
      setMatchIdx((i) => (i + 1) % snapshot.matches.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [open, revealed, snapshot.matches.length]);

  const filteredUsers = useMemo(() => {
    if (activeTab === 'superfas') {
      return snapshot.users.filter((u) => u.role === 'super-fa');
    }
    if (activeTab === 'album') {
      return snapshot.users.filter((u) => u.isListening);
    }
    if (activeTab === 'artistas') {
      return snapshot.users;
    }
    /* musica = ouvintes ativos do momento */
    return snapshot.users.filter((u) => u.isListening);
  }, [activeTab, snapshot.users]);

  if (!open) return null;

  const currentMatch = snapshot.matches[matchIdx];
  const matchCopy = currentMatch.copy.replace('{name}', currentMatch.name);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      {/* Background gradient sutil pra dar profundidade vs preto
       *  raso. Não usa blur pra evitar custo de GPU sobre o resto
       *  do shell que continua montado atrás. */}
      <div className={styles.bg} aria-hidden="true" />

      {/* Topbar: back + thumb da artista */}
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

      {/* Hero loading — orbe grande rotacionando + texto pulsante */}
      <div className={styles.hero}>
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

      {/* Conteúdo abaixo do hero — fade-in staggered ao "revelar". */}
      <div className={`${styles.body} ${revealed ? styles.bodyRevealed : ''}`}>
        {/* Cluster com top 12 listeners + headline */}
        <section className={styles.cluster}>
          <div className={styles.clusterAvatars}>
            {snapshot.topListeners.slice(0, 12).map((l, i) => (
              <span
                key={l.id}
                className={styles.clusterAvatar}
                style={{ zIndex: 12 - i }}
                title={l.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.avatarUrl} alt={l.name} />
              </span>
            ))}
          </div>
          <p className={styles.clusterHeadline}>
            <strong>{snapshot.peopleCount.toLocaleString('pt-BR')}</strong>{' '}
            pessoas curtindo <strong>Ana Castela</strong> com você!
          </p>
        </section>

        {/* Match pill com gradient border (rotaciona a cada 4s) */}
        <section className={styles.matchPill} key={currentMatch.id}>
          <span className={styles.matchAvatar}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentMatch.avatarUrl} alt={currentMatch.name} />
          </span>
          <span className={styles.matchCopy}>{matchCopy}</span>
          <span className={styles.matchHeart} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21s-7-4.5-9.5-9C.7 8.6 2.6 4.5 6.4 4.5c1.9 0 3.6 1.1 4.6 2.8 1-1.7 2.7-2.8 4.6-2.8 3.8 0 5.7 4.1 3.9 7.5C19 16.5 12 21 12 21z" />
            </svg>
          </span>
        </section>

        {/* Stats grid — 4 cards com os números do snapshot */}
        <section className={styles.stats}>
          <StatCard label="Mesma música agora" value={snapshot.sameSongCount} />
          <StatCard label="Mesmo álbum agora" value={snapshot.sameAlbumCount} />
          <StatCard label="Países conectados" value={snapshot.countriesCount} />
          <StatCard label="Pessoas online" value={snapshot.peopleCount} />
        </section>

        {/* Tabs decorativas com contadores */}
        <div className={styles.tabs} role="tablist">
          <TabBtn
            active={activeTab === 'musica'}
            onClick={() => setActiveTab('musica')}
            label="Música"
            count={snapshot.sameSongCount}
          />
          <TabBtn
            active={activeTab === 'superfas'}
            onClick={() => setActiveTab('superfas')}
            label="Super Fãs"
            count={snapshot.users.filter((u) => u.role === 'super-fa').length}
          />
          <TabBtn
            active={activeTab === 'album'}
            onClick={() => setActiveTab('album')}
            label="Álbum"
            count={snapshot.sameAlbumCount}
          />
          <TabBtn
            active={activeTab === 'artistas'}
            onClick={() => setActiveTab('artistas')}
            label="Artistas"
            count={snapshot.users.length}
          />
        </div>

        {/* Lista navegável de usuários */}
        <section className={styles.userList}>
          {filteredUsers.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value.toLocaleString('pt-BR')}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`${styles.tab} ${active ? styles.tabActive : ''}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <span className={styles.tabCount}>({count.toLocaleString('pt-BR')})</span>
    </button>
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
            <span className={styles.userRole}>{ROLE_LABEL[user.role]}</span>
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
          <svg viewBox="0 0 24 24" fill={user.isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M12 21s-7-4.5-9.5-9C.7 8.6 2.6 4.5 6.4 4.5c1.9 0 3.6 1.1 4.6 2.8 1-1.7 2.7-2.8 4.6-2.8 3.8 0 5.7 4.1 3.9 7.5C19 16.5 12 21 12 21z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
