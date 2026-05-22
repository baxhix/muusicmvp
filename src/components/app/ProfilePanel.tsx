'use client';

import { useEffect, useRef, useState } from 'react';
import NowPlaying from './NowPlaying';
import NowPlayingPreview from './NowPlayingPreview';
import { useListeningHistory } from '@/hooks/useListeningHistory';
import { useMyActivities } from '@/hooks/useMyActivities';
import type { ApiActivityItem, ApiHistoryItem } from '@/lib/api/types';
import styles from './ProfilePanel.module.css';

/* ── Types ─────────────────────────────────────────────── */
type TabId = 'historico' | 'atividade' | 'comunidades' | 'idolos';

export interface ProfileUser {
  id: string;
  name: string;
  city: string;
  state: string;
  streams: number;
  /** Total fan points accumulated across all activities. */
  fanpoints: number;
  img: string;
  isOnline: boolean;
  nowPlaying?: { title: string; artist: string; cover?: string };
}

interface Props {
  user: ProfileUser;
  isOwnProfile?: boolean;
  onClose?: () => void;
  /** Own-profile only: opens the EditProfileModal. */
  onEditProfile?: () => void;
  /** Own-profile only: opens the user's messages surface (Superchat). */
  onOpenMessages?: () => void;
  /** Other-profile only: starts/jumps to a DM with the displayed user. */
  onSendMessage?: (userId: string, label: string) => void;
  /** Other-profile only: report this user. */
  onReport?: (userId: string, label: string) => void;
}

/* ── Static mock content ─────────────────────────────────── */
const TABS: { id: TabId; label: string }[] = [
  { id: 'historico',   label: 'Histórico'         },
  { id: 'atividade',   label: 'Minha Atividade'   },
  { id: 'comunidades', label: 'Comunidades'       },
  { id: 'idolos',      label: 'Ídolos'            },
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

function describeActivity(a: ApiActivityItem): string {
  switch (a.kind) {
    case 'stream':
      if (a.trackTitle) {
        return `Tocou “${a.trackTitle}”${a.trackArtist ? ` — ${a.trackArtist}` : ''}`;
      }
      return 'Tocou uma música';
    case 'login':
      return 'Fez login no muusic';
    case 'chat_started':
      return a.conversationSlug === 'superchat'
        ? 'Entrou no Superchat'
        : 'Iniciou uma nova conversa';
    default:
      return 'Atividade';
  }
}

function activityIcon(kind: ApiActivityItem['kind']) {
  if (kind === 'stream') {
    return (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 1v9" /><path d="M6 3v9" />
        <circle cx="4.5" cy="12" r="1.5" />
        <circle cx="8.5" cy="10" r="1.5" />
      </svg>
    );
  }
  if (kind === 'login') {
    return (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 1.5l-3 3 3 3" /><path d="M4 4.5h7" />
        <path d="M11 8.5v3a1 1 0 0 1-1 1H3" />
      </svg>
    );
  }
  // chat_started
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 12 4v4.5a1.5 1.5 0 0 1-1.5 1.5H6l-3 2.5V9.5a1.5 1.5 0 0 1-1-1.5z" />
    </svg>
  );
}

function ActivityRow({ item }: { item: ApiActivityItem }) {
  return (
    <div className={styles.activityItem}>
      <div className={`${styles.activityIcon} ${styles[`activityIcon_${item.kind}`]}`}>
        {activityIcon(item.kind)}
      </div>
      <div className={styles.activityInfo}>
        <span className={styles.activityText}>{describeActivity(item)}</span>
        <span className={styles.activityTime}>{timeAgo(item.createdAt)}</span>
      </div>
      <span className={styles.activityPoints}>+{item.points}</span>
    </div>
  );
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
export default function ProfilePanel({
  user,
  isOwnProfile = false,
  onClose,
  onEditProfile,
  onOpenMessages,
  onSendMessage,
  onReport,
}: Props) {
  const [tab, setTab] = useState<TabId>('historico');
  const [online, setOnline] = useState<boolean>(user.isOnline);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const reportMenuRef = useRef<HTMLDivElement | null>(null);

  // Click-outside dismisses the report dropdown so it doesn't trap
  // focus when the user moves on.
  useEffect(() => {
    if (!reportMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (reportMenuRef.current?.contains(e.target as Node)) return;
      setReportMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [reportMenuOpen]);
  // History only meaningful for the logged-in user (others' history isn't
  // exposed by the API). When isOwnProfile=false, the hook returns [].
  const { items: history, loading: historyLoading, toggleLike } = useListeningHistory();
  const { items: activities, totalPoints, loading: activitiesLoading } = useMyActivities();

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
            <span className={styles.userMetaSep}>·</span>
            <span className={styles.userFanpointsNum}>
              {user.fanpoints.toLocaleString('pt-BR')}
            </span>{' '}
            <span className={styles.userFanpointsLabel}>FP</span>
          </p>
        </div>

        {/* ── Player + Online/Offline toggle (toggle só no próprio perfil) ──
         *
         * Quando é o PRÓPRIO perfil, renderiza o <NowPlaying embed />
         * com controles completos — é o player do usuário logado e
         * faz sentido controlar daqui.
         *
         * Quando é o perfil de OUTRO usuário, renderiza só o
         * <NowPlayingPreview /> com os dados de `user.nowPlaying`
         * (track atual deles). Sem controles, sem botões de Spotify,
         * sem progress bar — o player do outro usuário só está
         * sendo EXIBIDO, não controlado. Per product feedback. */}
        {user.nowPlaying && (
          <div className={styles.playerRow}>
            {isOwnProfile ? (
              <>
                <NowPlaying embed />
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
              </>
            ) : (
              <NowPlayingPreview track={user.nowPlaying} />
            )}
          </div>
        )}

        {/* ── Botões de ação ──────────────────────────────
            Own profile:  [ Editar perfil ] [ Minhas mensagens ]
            Other profile: [ Enviar mensagem  ] [ ⋯ → Denunciar ]
            The "Acenar" CTA was removed per product feedback —
            waves still happen on the map marker (heart icon next to
            the live-user pin), so the action is reachable, just not
            duplicated inside the profile panel. The "⋯" menu only
            renders for other profiles. */}
        <div className={styles.actionsRow}>
          {isOwnProfile ? (
            <>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  // NOTE: do NOT call `onClose?.()` here. The
                  // perfil page wires onClose to
                  // `router.push('/app')`, which unmounts the
                  // page that owns the modal's `showEditProfile`
                  // state. If both fire, the modal flashes for one
                  // frame (or doesn't render at all) before the
                  // page unmounts and takes the modal with it.
                  // We want the user to stay on /app/perfil so
                  // the modal can open AND stay open until they
                  // close it themselves.
                  onEditProfile?.();
                }}
              >
                Editar perfil
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  // onOpenMessages already navigates to
                  // /app/superchat. The earlier `onClose?.()` call
                  // here was a redundant router.push('/app')
                  // that Next.js superseded with the second push
                  // — harmless on this path but kept simple now
                  // that the symmetric "Editar perfil" handler
                  // dropped it for the bug fix above.
                  onOpenMessages?.();
                }}
                aria-label="Minhas mensagens"
              >
                Minhas mensagens
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => onSendMessage?.(user.id, user.name)}
                aria-label={`Enviar mensagem para ${user.name}`}
              >
                Enviar mensagem
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
              <div className={styles.reportMenuWrap} ref={reportMenuRef}>
                <button
                  type="button"
                  className={styles.reportMenuBtn}
                  onClick={() => setReportMenuOpen((v) => !v)}
                  aria-label="Mais opções"
                  aria-expanded={reportMenuOpen}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </button>
                {reportMenuOpen && (
                  <div className={styles.reportMenu} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.reportMenuItem}
                      onClick={() => {
                        setReportMenuOpen(false);
                        onReport?.(user.id, user.name);
                      }}
                    >
                      Denunciar usuário
                    </button>
                  </div>
                )}
              </div>
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

          {tab === 'atividade' && (
            isOwnProfile ? (
              <>
                <div className={styles.activityHeader}>
                  <div className={styles.activityTotal}>
                    <span className={styles.activityTotalValue}>
                      {totalPoints.toLocaleString('pt-BR')}
                    </span>
                    <span className={styles.activityTotalLabel}>pontos totais</span>
                  </div>
                  <p className={styles.activityScoring}>
                    +100 por música · +200 por nova conversa · +50 por login
                  </p>
                </div>
                {activitiesLoading ? (
                  <div className={styles.historyEmpty}>Carregando atividades…</div>
                ) : activities.length === 0 ? (
                  <div className={styles.historyEmpty}>
                    Ainda sem atividade registrada. Faça login, toque uma música
                    ou inicie uma conversa pra começar a pontuar.
                  </div>
                ) : (
                  activities.map((a) => <ActivityRow key={a.id} item={a} />)
                )}
              </>
            ) : (
              <div className={styles.historyEmpty}>Atividade privada.</div>
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
