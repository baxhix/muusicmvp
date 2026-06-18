'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import NowPlaying from './NowPlaying';
import Skeleton from './Skeleton';
import TruncatedText from './TruncatedText';
import NowPlayingPreview from './NowPlayingPreview';
import RankMedallion from './RankMedallion';
import { useListeningHistory } from '@/hooks/useListeningHistory';
import { useMyActivities } from '@/hooks/useMyActivities';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useRanking } from '@/hooks/useRanking';
import { useCommunities } from '@/hooks/useCommunities';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { api } from '@/lib/api/client';
import { track } from '@/lib/analytics';
import MotionSwitch from './MotionSwitch';
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
  /** Own-profile only: opens the notification preferences modal. */
  onOpenNotifications?: () => void;
  /** Other-profile only: starts/jumps to a DM with the displayed user. */
  onSendMessage?: (userId: string, label: string) => void;
  /** Other-profile only: report this user. */
  onReport?: (userId: string, label: string) => void;
}

/* ── Static mock content ─────────────────────────────────── */
const TABS: { id: TabId; label: string; mobileLabel?: string }[] = [
  { id: 'historico',   label: 'Histórico'         },
  /* mobileLabel: abrevia "Minha Atividade" → "Atividade" pra não
   * truncar em viewports pequenos (tab fica com largura limitada
   * por flex:1). */
  { id: 'atividade',   label: 'Minha Atividade', mobileLabel: 'Atividade' },
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
        <TruncatedText className={styles.activityText}>{describeActivity(item)}</TruncatedText>
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
        <TruncatedText className={styles.historyTitle}>{item.title}</TruncatedText>
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
  onOpenNotifications,
  onSendMessage,
  onReport,
}: Props) {
  const isMobile = useIsMobile();
  /* Tabs visíveis em DESKTOP e MOBILE iguais — apenas Atividade +
   * Comunidades. Per product feedback "Deixe as mesmas tabs:
   * Atividade e Comunidades" (no desktop) + "Remova o Histórico"
   * / "Remova a parte de Ídolos" (mobile). */
  const visibleTabs = useMemo(
    () => TABS.filter((t) => t.id !== 'historico' && t.id !== 'idolos'),
    [],
  );
  const [tab, setTab] = useState<TabId>('atividade');
  // Se o user troca de viewport (raro mas possível) e a tab atual
  // sumiu, cai pra primeira tab visível pra não ficar limbo.
  useEffect(() => {
    if (!visibleTabs.find((t) => t.id === tab)) {
      setTab(visibleTabs[0]?.id ?? 'atividade');
    }
  }, [visibleTabs, tab]);
  /* Posição atual do user no ranking pra mostrar "(#N)" ao lado
   * dos Fanpoints no mobile, per product feedback "Logo à frente
   * de 452 Fanpoints, coloque (#56) que é a posição atual dele". */
  const { ranking } = useRanking(true);
  /* Comunidades existentes da plataforma — substitui o mock COMMUNITIES
   * por dados reais per product feedback "Na aba Comunidades (desk
   * e mobile), liste as comunidades existentes na plataforma".
   * `enabled: true` SEMPRE — perfil sempre carrega lista pra que a
   * aba Comunidades já tenha o cache quando clicada. */
  const { items: communitiesList } = useCommunities({ enabled: true });
  const navRouter = useRouter();
  const userRankPosition = useMemo(() => {
    const idx = ranking.findIndex((r) => r.userId === user.id);
    return idx >= 0 ? idx + 1 : null;
  }, [ranking, user.id]);
  const [online, setOnline] = useState<boolean>(user.isOnline);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const reportMenuRef = useRef<HTMLDivElement | null>(null);

  // ── "Aparecer no mapa" = consentimento LGPD real (own-profile) ──
  // Vive aqui (logo abaixo do toggle Online) pra gestão fácil. Espelha
  // authUser.locationConsent + persiste no PATCH /api/me/location-consent;
  // a revogação tira o usuário do mapa dos outros na hora (listOnlineUsers
  // filtra por location_consent). Optimistic + rollback + toast no erro.
  const { user: authUser, refresh: refreshAuth } = useAuth();
  const isMinor = Boolean(authUser?.isMinor);
  const [appearOnMap, setAppearOnMap] = useState(Boolean(authUser?.locationConsent));
  const [consentBusy, setConsentBusy] = useState(false);
  useEffect(() => {
    setAppearOnMap(Boolean(authUser?.locationConsent));
  }, [authUser?.locationConsent]);
  const handleAppearOnMap = async (next: boolean) => {
    if (consentBusy || isMinor) return;
    setAppearOnMap(next);
    setConsentBusy(true);
    try {
      await api.patch('/api/me/location-consent', { consent: next });
      if (next) track('location_consent_granted', { surface: 'settings' });
      else track('location_consent_revoked', {});
      await refreshAuth();
    } catch (err) {
      setAppearOnMap(!next); // rollback
      console.error('location consent toggle failed:', err);
      try {
        window.dispatchEvent(
          new CustomEvent('app:toast', {
            detail: { message: 'Não consegui atualizar sua visibilidade no mapa. Tenta de novo.' },
          }),
        );
      } catch { /* SSR */ }
    } finally {
      setConsentBusy(false);
    }
  };

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

      {/* ── Header — close + kebab "Mais opções" lado a lado per
       * product feedback "Na tela de Perfil os botões de fechar e
       * três pontinhos estão sobrepostos. Deixe um ao lado do
       * outro". Mobile esconde o título (.headerTitle) via @media
       * mas mantém os botões visíveis. */}
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>
          {isOwnProfile ? 'Meu perfil' : 'Perfil'}
        </h2>
        <div className={styles.headerActions}>
          {!isOwnProfile && (
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
          )}
          <button className={styles.closeBtn} aria-label="Fechar" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.scroll}>

        {/* ── Avatar ── */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarWrap}>
            <div className={`${styles.avatarRing} ${user.isOnline ? styles.online : styles.offline}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={user.img} src={user.img} alt={user.name} className={styles.avatarImg} />
            </div>
            {/* Online dot — bolinha verde/cinza no canto inferior
             * direito do avatar per product feedback "Adicione a
             * bolinha que identifica se está online ou não". */}
            <span
              className={`${styles.avatarPresence} ${user.isOnline ? styles.avatarPresenceOn : ''}`}
              aria-label={user.isOnline ? 'Online' : 'Offline'}
              title={user.isOnline ? 'Online' : 'Offline'}
            />
            {/* Medalhão Top 10 (coroa #1 / estrela #2–10) no canto
             * sup-dir do avatar — oposto ao dot de presença. */}
            <RankMedallion position={userRankPosition} size="lg" />
          </div>
        </div>

        {/* ── User info ── */}
        <div className={styles.userInfo}>
          <p className={styles.userName}>{user.name}</p>
          <p className={styles.userMetaLine}>
            {/* Cidade + estado só renderizam se tiverem valor real
             * (trim pra ignorar strings vazias/whitespace). Per
             * product feedback "Quando não tiver o registro da
             * cidade, não deixe nada nem os caracteres de
             * separação". Quando ambos vazios, nem city nem o
             * separador depois saem na linha. */}
            {(() => {
              const c = (user.city ?? '').trim();
              const s = (user.state ?? '').trim();
              const cityLine = [c, s].filter(Boolean).join(', ');
              if (!cityLine) return null;
              return (
                <>
                  <span className={styles.userMetaCity}>{cityLine}</span>
                  <span className={`${styles.userMetaSep} ${styles.userMetaSepCity}`}>·</span>
                </>
              );
            })()}
            {/* Bloco "Total de Streams" removido por completo per
             * product feedback "Oculte o bloco Total de Streams". */}
            <span className={styles.userFanpointsNum}>
              {user.fanpoints.toLocaleString('pt-BR')}
            </span>{' '}
            <span className={styles.userFanpointsLabel}>FP</span>
            {userRankPosition !== null && (
              <span className={styles.userRankPos}>(#{userRankPosition})</span>
            )}
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
        {/* Player só renderiza se o user TIVER algo tocando — per
         * product feedback "Se o usuário não estiver ouvindo nada,
         * não mostre as animações de áudio nem o card de música
         * tocando". user.nowPlaying é null/undefined quando não
         * há track ativa, então a condição já cobre. */}
        {user.nowPlaying ? (
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
        ) : null}

        {/* ── Aparecer no mapa (own-profile) — logo abaixo do Online ──
            Consentimento LGPD real, gerenciável direto daqui. */}
        {isOwnProfile && (
          <div className={styles.mapRow}>
            <div className={styles.mapRowText}>
              <span className={styles.mapRowTitle}>Aparecer no mapa</span>
              <span className={styles.mapRowDesc}>
                {isMinor
                  ? 'Indisponível para menores de 18 anos.'
                  : 'Mostra você no mapa pros outros fãs (localização aproximada). Desligar te esconde na hora.'}
              </span>
            </div>
            <MotionSwitch
              checked={appearOnMap}
              onCheckedChange={handleAppearOnMap}
              disabled={isMinor || consentBusy}
              ariaLabel="Aparecer no mapa"
            />
          </div>
        )}

        {/* ── Botões de ação ──────────────────────────────
            Own profile:  [ — removed — ] per spec "remova os
              botões Notificações, Editar Perfil e Minhas
              Mensagens"
            Other profile: [ Enviar mensagem ] [ reações ] */}
        <div className={styles.actionsRow}>
          {isOwnProfile ? null : (
            <>
              {/* Reações rápidas (❤️ 👋 💬 👀) à ESQUERDA do botão
               * Enviar mensagem per product feedback "Adicione no
               * perfil de usuários que não sou 'eu' [...] as reações
               * que tem nos avatares flutuantes, ao lado esquerdo do
               * botão enviar mensagem". ❤️ / 👋 / 👀 disparam a
               * cascata global; 💬 abre a conversa direta. */}
              <div className={styles.reactionsRow} aria-label="Reações rápidas">
                {(['❤️', '👋', '💬', '👀'] as const).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={styles.reactionBtn}
                    aria-label={emoji === '💬' ? `Enviar mensagem para ${user.name}` : `Reagir com ${emoji}`}
                    onClick={() => {
                      if (emoji === '💬') {
                        onSendMessage?.(user.id, user.name);
                      } else {
                        try {
                          window.dispatchEvent(
                            new CustomEvent('app:hearts-cascade', {
                              detail: { text: emoji },
                            }),
                          );
                        } catch { /* SSR */ }
                      }
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
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
            </>
          )}
        </div>

        {/* Linha de Notificações REMOVIDA per spec "remova os
         * botões Notificações, Editar Perfil e Minhas Mensagens".
         * O acesso a notificações continua via outras surfaces
         * (TopBar drawer + bell mobile). */}

        {/* ── Tabs (motion Tab select) ──
         * Mobile: oculta "Histórico" via visibleTabs filtrado +
         * .tabs ganha estilo Fanverse (pill compacto) via CSS
         * @media. Pill ativo desliza entre as tabs via motion
         * layoutId="profileTabPill" (id distinto pra não bleed
         * com outras surfaces). Cores preservadas do segmented-
         * control inset. */}
        <div className={styles.tabs} role="tablist">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={styles.tab}
              onClick={() => setTab(t.id)}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="profileTabPill"
                  className={styles.tabPill}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className={styles.tabLabel}>
                {isMobile && t.mobileLabel ? t.mobileLabel : t.label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className={styles.tabContent}>

          {tab === 'historico' && (
            isOwnProfile ? (
              historyLoading ? (
                <div style={{ padding: '0 18px' }}>
                  <Skeleton count={5} height={48} gap={6} ariaLabel="Carregando histórico" />
                </div>
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
              (() => {
                /* Per spec "em Minha atividade, liste as últimas
                 * ações que registraram Fanpoints" — filtra fora
                 * atividades com points === 0 (ex: `stream` no
                 * regime atual deflacionado, login que não rendeu,
                 * etc). Só mostra movimentação positiva. */
                const fpActivities = activities.filter((a) => a.points > 0);
                return (
                  <>
                    <div className={styles.activityHeader}>
                      <div className={styles.activityTotal}>
                        <span className={styles.activityTotalValue}>
                          {totalPoints.toLocaleString('pt-BR')}
                        </span>
                        <span className={styles.activityTotalLabel}>Fanpoints totais</span>
                      </div>
                      <p className={styles.activityScoring}>
                        +50 login · +15 share · +10 comentário · +5 curtida
                      </p>
                    </div>
                    {activitiesLoading ? (
                      <div style={{ padding: '0 18px' }}>
                        <Skeleton count={5} height={48} gap={6} ariaLabel="Carregando atividades" />
                      </div>
                    ) : fpActivities.length === 0 ? (
                      <div className={styles.historyEmpty}>
                        Ainda sem ações que registraram Fanpoints. Faça login,
                        compartilhe, comente ou curta pra começar a pontuar.
                      </div>
                    ) : (
                      fpActivities.map((a) => <ActivityRow key={a.id} item={a} />)
                    )}
                  </>
                );
              })()
            ) : (
              <div className={styles.historyEmpty}>Atividade privada.</div>
            )
          )}

          {tab === 'comunidades' && (
            communitiesList.length === 0 ? (
              <div className={styles.historyEmpty}>
                Nenhuma comunidade ainda.
              </div>
            ) : (
              communitiesList.map((c) => (
                <motion.div
                  key={c.id}
                  className={styles.communityItem}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                >
                  <div className={styles.communityEmoji}>
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }}
                      />
                    ) : (
                      '👥'
                    )}
                  </div>
                  <div className={styles.communityInfo}>
                    <TruncatedText className={styles.communityName}>{c.name}</TruncatedText>
                    <span className={styles.communityMembers}>
                      {c.memberCount.toLocaleString('pt-BR')} {c.memberCount === 1 ? 'membro' : 'membros'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.joinBtn}
                    onClick={() => {
                      navRouter.push(`/app/comunidades/${c.slug}`);
                      onClose?.();
                    }}
                  >
                    {/* "Abrir" → "Participar" per spec "substitua
                     * o botão abrir por Participar". Mesmo label
                     * pra membros e não-membros (clicar leva pra
                     * comunidade em ambos os casos). */}
                    <span className={styles.joinBtnLabel}>Participar</span>
                  </button>
                </motion.div>
              ))
            )
          )}

          {tab === 'idolos' && (
            <div className={styles.idolGrid}>
              {IDOLS.map(idol => (
                <div key={idol.id} className={styles.idolItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={idol.img} alt={idol.name} className={styles.idolImg} />
                  <TruncatedText className={styles.idolName}>{idol.name}</TruncatedText>
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
