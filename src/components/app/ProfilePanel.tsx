'use client';

import { useState } from 'react';
import NowPlaying from './NowPlaying';
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

const HISTORY = [
  { id: 'h1', title: 'Forro da Despedida', artist: 'Forró do Alagoano', ago: '5 min',  img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120&q=80' },
  { id: 'h2', title: 'Bem Bolado',         artist: 'Xote das Meninas',  ago: '12 min', img: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=120&q=80' },
  { id: 'h3', title: 'Solteiro Feliz',     artist: 'Simone & Simaria',  ago: '1 h',    img: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=120&q=80' },
  { id: 'h4', title: 'Amei Te Ver',        artist: 'Tiago Iorc',        ago: '2 h',    img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&q=80' },
  { id: 'h5', title: 'Erro Gostoso',       artist: 'Wesley Safadão',    ago: '3 h',    img: '/ana-castela-box.jpg' },
  { id: 'h6', title: 'Olha Onde Eu Tô',    artist: 'Gusttavo Lima',     ago: '5 h',    img: 'https://images.unsplash.com/photo-1525362081669-2b476bb628c3?w=120&q=80' },
];

const FALLBACK_THUMB = '/ana-castela-box.jpg';

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
              <img src={user.img} alt={user.name} className={styles.avatarImg} />
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

          {tab === 'historico' && HISTORY.map(item => (
            <div key={item.id} className={styles.historyItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.img}
                alt={item.title}
                className={styles.historyThumb}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith(FALLBACK_THUMB)) {
                    target.src = FALLBACK_THUMB;
                  }
                }}
              />
              <div className={styles.historyInfo}>
                <span className={styles.historyTitle}>{item.title}</span>
                <span className={styles.historyArtist}>{item.artist}</span>
              </div>
              <span className={styles.historyAgo}>{item.ago}</span>
            </div>
          ))}

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
