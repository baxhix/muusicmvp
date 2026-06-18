'use client';

import { useState } from 'react';
import type { ApiConversationSummary } from '@/lib/api/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import VerifiedBadge from './VerifiedBadge';
import RankMedallion from './RankMedallion';
import { useRankBands } from './RankBandsProvider';
import styles from './LiveChatStack.module.css';

interface Props {
  conversations: ApiConversationSummary[];
  activeId: string | null;
  /**
   * Set of currently-online user ids. Drives the green/gray ring +
   * status dot per avatar (via `useLiveUsers`'s presence stream).
   */
  onlineUserIds?: ReadonlySet<string>;
  onOpen: (conversationId: string) => void;
  /**
   * Mobile-only: opens the full conversations list. Rendered as a
   * "view all" chat icon BELOW the 3 most-recent avatars so the
   * user has a quick path to every other thread from the home
   * surface without going through the route shortcuts.
   */
  onOpenAll?: () => void;
  /**
   * Total agregado de mensagens não lidas em TODAS as conversas
   * do user. Drives o badge vermelho com número branco no botão
   * "+" — visível tanto desktop quanto mobile. Quando 0 (zero
   * conversas com unread), o badge não renderiza.
   */
  totalUnreadCount?: number;
  /**
   * Quando true, o dock fica como "preview atrás do blur": borrado,
   * esmaecido e não-interativo. Usado no desktop enquanto o drawer de
   * Chat está aberto — em vez de o dock sumir (fricção de "coisas
   * desaparecendo"), ele continua visível só que de fundo, mantendo o
   * contexto das conversas recentes.
   */
  dimmed?: boolean;
}

/** Limites por viewport, per product feedback "no desktop deixe
 *  apenas 6 usuários recentes ... no mobile, mantenha apenas 4"
 *  (antes 5 mobile / 7 desktop). */
const DOCK_LIMIT_MOBILE = 4;
const DOCK_LIMIT_DESKTOP = 6;

/**
 * Right-edge stack of the 3 latest conversation avatars. Click an
 * avatar to open the corresponding LiveChatPanel. The hamburger
 * trigger + Feed + Comunidade shortcuts used to share this column
 * but have moved up to the page's centered topBar.
 */
export default function LiveChatStack({
  conversations,
  activeId,
  onlineUserIds,
  onOpen,
  onOpenAll,
  totalUnreadCount = 0,
  dimmed = false,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const dockLimit = isMobile ? DOCK_LIMIT_MOBILE : DOCK_LIMIT_DESKTOP;
  const { rankOf } = useRankBands();

  // Include DMs (resolvable other user) AND user-created groups.
  // O grupo "Superchat" (com ícone do chapéu Ana Castela) está
  // FILTRADO per product feedback "Remova o item ou grupo Superchat,
  // que tem o chapeu como icone, marcado como tendo 28 membros".
  // Detecção por nome porque a API não expõe slug; mesma matching
  // que o ConversationsSidebar usa.
  const dockable = conversations.filter((c) => {
    if (c.type === 'dm') return !!c.otherUser;
    if (c.type !== 'group' || !c.name) return false;
    if (c.name === 'Superchat') return false;
    return true;
  });
  const items = dockable.slice(0, dockLimit);

  return (
    <div className={`${styles.dock} ${dimmed ? styles.dockDimmed : ''}`}>
      <span className={styles.label}>Chat</span>

      <div className={styles.list}>
        {items.map((c) => {
          const isGroup = c.type === 'group';
          // Normalize fields so the rest of the render is shape-agnostic.
          const u = c.otherUser;
          const displayName = isGroup
            ? (c.name ?? 'Grupo')
            : (u?.name ?? 'Conversa');
          const seedId = isGroup ? c.id : (u?.id ?? c.id);
          // Global Superchat group surfaces in the dock with the
          // Ana Castela cowboy-hat icon. See ConversationsSidebar
          // for the matching identification + rationale; both
          // surfaces detect by name because the API doesn't
          // currently expose the conversation slug.
          const isSuperchat = isGroup && c.name === 'Superchat';
          const img = isSuperchat
            ? '/icon-chapeu-ac.svg'
            : isGroup
              ? (c.imageUrl ?? '/avatar-placeholder.svg')
              : (u?.avatarUrl ?? '/avatar-placeholder.svg');
          const isActive = activeId === c.id;
          const preview = c.lastMessage?.body;
          // Groups have no presence concept — always "active" visually
          // (no grayscale, no ring). DMs use the live presence set.
          const isOnline = isGroup
            ? true
            : (onlineUserIds?.has(u?.id ?? '') ?? false);
          const isVerified = !isGroup && !!u?.verified;

          const unread = c.unreadCount;
          const statusLabel = isGroup
            ? `${c.memberCount ?? 0} membros`
            : isOnline ? 'online' : 'offline';
          const ariaLabel = unread > 0
            ? `${displayName}, ${statusLabel}, ${unread} ${unread === 1 ? 'mensagem' : 'mensagens'} não lidas`
            : `${displayName}, ${statusLabel}`;

          return (
            <button
              key={c.id}
              className={`${styles.item} ${isActive ? styles.itemActive : ''} ${isOnline ? '' : styles.itemOffline}`}
              onClick={() => onOpen(c.id)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={ariaLabel}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={displayName}
                className={`${styles.avatar} ${isOnline ? '' : styles.avatarOffline} ${isGroup ? styles.avatarGroup : ''}`}
                onError={(e) => {
                  // Avatar 404? Fall back to the silhouette so the dock
                  // never shows a broken-image icon (and never paints a
                  // random stranger's pravatar.cc photo on a real user).
                  const img = e.currentTarget;
                  const fb = '/avatar-placeholder.svg';
                  if (img.src.endsWith(fb)) return;
                  img.src = fb;
                }}
              />

              {/* Medalhão de rank — Top 10. Canto sup-esquerdo pra não
                  colidir com verified (sup-dir) nem presença (inf-dir).
                  Só DMs (grupo não tem rank de 1 user). */}
              <RankMedallion
                position={isGroup ? null : rankOf(u?.id)}
                size="sm"
                corner="tl"
              />

              {/* Presence dot — DMs only. Groups don't have a
                  single "online" state, so skip the indicator
                  entirely instead of showing a misleading dot. */}
              {!isGroup && (
                <span
                  className={`${styles.statusDot} ${isOnline ? styles.statusDotOnline : styles.statusDotOffline}`}
                  aria-hidden="true"
                />
              )}

              {/* Verified check — DM-only (group avatars don't
                  carry a verified flag). */}
              {isVerified && (
                <span className={styles.verifiedBadge}>
                  <VerifiedBadge size={16} />
                </span>
              )}

              {unread > 0 && (
                <span className={styles.unreadBadge} aria-hidden="true">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}

              {hovered === c.id && (
                <div className={styles.tooltip}>
                  <span className={styles.tooltipName}>{displayName}</span>
                  {preview && <span className={styles.tooltipSub}>{preview}</span>}
                </div>
              )}
            </button>
          );
        })}

        {/* Botão "+" abaixo das miniaturas — abre a lista completa
            de conversas (que tem o FAB de Nova conversa/Novo grupo
            internamente). Per product feedback "Substitua o ícone
            de mensagens abaixo das miniaturas pelo botão de '+'
            com o mesmo tamanho que os avatares e no mesmo estilo
            que o '+' comunidade e novo grupo/conversa". Visível
            em desktop E mobile (era só mobile). */}
        {onOpenAll && (
          <button
            type="button"
            className={styles.viewAllBtn}
            onClick={onOpenAll}
            aria-label={
              totalUnreadCount > 0
                ? `Conversas, ${totalUnreadCount} ${totalUnreadCount === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`
                : 'Nova conversa ou grupo'
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {/* Badge agregado: soma de unreadCount em TODAS as
             * conversations. Branco em fundo vermelho, posicionado
             * no canto superior direito do "+". Visível desktop +
             * mobile (o "+" agora aparece nos dois). */}
            {totalUnreadCount > 0 && (
              <span className={styles.viewAllBadge} aria-hidden="true">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
