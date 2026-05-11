'use client';

import { useState } from 'react';
import NowPlaying from './NowPlaying';
import { useListeningHistory } from '@/hooks/useListeningHistory';
import type { ApiHistoryItem } from '@/lib/api/types';
import styles from './ProfilePanel.module.css';

/* ── Types ─────────────────────────────────────────────── */
type TabId = 'historico' | 'comunidades' | 'idolos';

export interface ProfileUser {
  id: string;
  name: string;
  city: string;
  state: string;
  streams: number;
  img: string;
  isOnline: boolean;
  nowPlaying?: { title: string; artist: string; cover?: string };
}

interface Props {
  user: ProfileUser;
  isOwnProfile?: boolean;
  onClose?: () => void;
  onEditProfile?: () => void;
}

/* ── Static mock content ─────────────────────────────────── */
const TABS: { id: TabId; label: string }[] = [
  { id: 'historico',   label: 'Histórico'   },
  { id: 'comunidades', label: 'Comunidades' },
  { id: 'idolos',      label: 'Ídolos'      },
];

const FALLBACK_THUMB = '/ana-castela-box.jpg';

function timeAgo(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60)     return 'agora';
  if (diffSec < 3600)   return `${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400)  return `${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} d`;
  return `${Math.floor(diffSec / 604800)} sem`;
}

function youtubeThumb(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

function HistoryRow({
  item,
  onToggleLike,
}: {
  item: ApiHistoryItem;
  onToggleLike: (id: string) => void;
}) {
  return (
    <div className={styles.historyItem}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={youtubeThumb(item.youtubeId)}
        alt={item.title}
        className={styles.historyThumb}
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.endsWith(FALLBACK_THUMB)) target.src = FALLBACK_THUMB;
        }}
      />
      <div className={styles.historyInfo}>
        <span className={styles.historyTitle}>{item.title}</span>
        <span className={styles.historyArtist}>
          {item.artist}
          {item.plays > 1 && (
            <span className={styles.historyPlays}> · {item.plays}× tocou</span>
          )}
        </span>
      </div>
      <button
        type="button"
        className={`${styles.likeBtn} ${item.liked ? styles.likeBtnOn : ''}`}
        onClick={() => onToggleLike(item.trackId)}
        aria-label={item.liked ? 'Remover curtida' : 'Curtir música'}
        aria-pressed={item.liked}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M12 21s-7-4.35-9.5-9.5C1 8 3.5 4.5 7 4.5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.5 0 6 3.5 4.5 7-2.5 5.15-9.5 9.5-9.5 9.5z"
            fill={item.liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span className={styles.historyAgo}>{timeAgo(item.lastPlayedAt)}</span>
    </div>
  );
}

const COMMUNITIES = [
  { id: 'c1', name: 'Fãs do Forró do Alagoano', members: '12,4k', emoji: '🎺' },
  { id: 'c2', name: 'São Paulo Fã Clube',        members: '8,2k',  emoji: '🌆' },
  { id: 'c3', name: 'Nordeste Musical',          members: '5,1k',  emoji: '🎵' },
  { id: 'c4', name: 'Sertanejo Universitário',   members: '21k',   emoji: '🤠' },
];

const IDOLS = [
  { id: 'i1', name: 'Forró do Alagoano', genre: 'Forró',     img: 'https://i.pravatar.cc/72?img=60' },
  { id: 'i2', name: 'Simone & Simaria',  genre: 'Sertanejo', img: 'https://i.pravatar.cc/72?img=45' },
  { id: 'i3', name: 'Wesley Safadão',    genre: 'Forró',     img: 'https://i.pravatar.cc/72?img=22' },
  { id: 'i4', name: 'Gusttavo Lima',     genre: 'Sertanejo', img: 'https://i.pravatar.cc/72?img=11' },
  { id: 'i5', name: 'Marília Mendonça',  genre: 'Sertanejo', img: 'https://i.pravatar.cc/72?img=35' },
];

/* ── Component ───────────────────────────────────────────── */
export default function ProfilePanel({ user, isOwnProfile = false, onClose, onEditProfile }: Props) {
  const [tab, setTab] = useState<TabId>('historico');
  const [online, setOnline] = useState<boolean>(user.isOnline);
  // History only meaningful for the logged-in user (others' history isn't
  // exposed by the API). When isOwnProfile=false, the hook returns [].
  const { items: history, loading: historyLoading, toggleLike } = useListeningHistory();

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Perfil">

      {/* ── Header (mesmo padrão do SuperfansPanel) ── */}
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>
          {isOwnProfile ? 'Meu perfil' : 'Perfil'}
        </h2>
        <button className={styles.closeBtn} aria-label="Fechar" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={styles.scroll}>

        {/* ── Avatar ── */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarWrap}>
            <div className={`${styles.avatarRing} ${user.isOnline ? styles.online : styles.offline}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={user.img} src={user.img} alt={user.name} className={styles.avatarImg} />
            </div>
          </div>
        </div>

        {/* ── User info ── */}
        <div className={styles.userInfo}>
          <p className={styles.userName}>{user.name}</p>
          <p className={styles.userMetaLine}>
            <span className={styles.userMetaCity}>{user.city}, {user.state}</span>
            <span className={styles.userMetaSep}>·</span>
            <span className={styles.userStreamsNum}>
              {user.streams.toLocaleString('pt-BR')}
            </span>{' '}
            <span className={styles.userStreamsLabel}>streams</span>
          </p>
        </div>

        {/* ── Player + Online/Offline toggle (toggle só no próprio perfil) ── */}
        {user.nowPlaying && (
          <div className={styles.playerRow}>
            <NowPlaying embed />
            {isOwnProfile && (
              <div className={styles.onlineToggleWrap}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={online}
                  aria-label={online ? 'Ficar offline' : 'Ficar online'}
                  className={`${styles.onlineToggle} ${online ? styles.onlineToggleOn : ''}`}
                  onClick={() => setOnline(v => !v)}
                >
                  <span className={styles.onlineToggleKnob} />
                </button>
                <span className={styles.onlineToggleLabel}>
                  {online ? 'Online' : 'Offline'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Botões de ação abaixo do player ── */}
        <div className={styles.actionsRow}>
          {isOwnProfile ? (
            <>
              <button
                className={styles.actionBtn}
                onClick={() => {
                  onClose?.();
                  onEditProfile?.();
                }}
              >
                Editar perfil
              </button>
              <button className={styles.actionBtn} aria-label="Chat">
                Chat
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <button className={styles.actionBtn}>Seguir</button>
              <button className={styles.actionBtn} aria-label="Chat">
                Chat
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className={styles.tabContent}>

          {tab === 'historico' && (
            isOwnProfile ? (
              historyLoading ? (
                <div className={styles.historyEmpty}>Carregando histórico…</div>
              ) : history.length === 0 ? (
                <div className={styles.historyEmpty}>
                  Ainda não tem música no histórico. Bota pra tocar lá embaixo
                  pra começar a registrar.
                </div>
              ) : (
                history.map((item) => (
                  <HistoryRow
                    key={item.trackId}
                    item={item}
                    onToggleLike={toggleLike}
                  />
                ))
              )
            ) : (
              <div className={styles.historyEmpty}>
                Histórico privado.
              </div>
            )
          )}

          {tab === 'comunidades' && COMMUNITIES.map(c => (
            <div key={c.id} className={styles.communityItem}>
              <div className={styles.communityEmoji}>{c.emoji}</div>
              <div className={styles.communityInfo}>
                <span className={styles.communityName}>{c.name}</span>
                <span className={styles.communityMembers}>{c.members} membros</span>
              </div>
              <button className={styles.joinBtn}>Entrar</button>
            </div>
          ))}

          {tab === 'idolos' && (
            <div className={styles.idolGrid}>
              {IDOLS.map(idol => (
                <div key={idol.id} className={styles.idolItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={idol.img} alt={idol.name} className={styles.idolImg} />
                  <span className={styles.idolName}>{idol.name}</span>
                  <span className={styles.idolGenre}>{idol.genre}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
    </>
  );
}
