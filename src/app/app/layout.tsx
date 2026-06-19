'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppShellProvider, useAppShell } from '@/lib/app/AppShellContext';
import { RankBandsProvider } from '@/components/app/RankBandsProvider';
import { useIsMobile } from '@/hooks/useIsMobile';
import BottomNav from '@/components/app/BottomNav';
import TopBar from '@/components/app/TopBar';
import ArtistBox from '@/components/app/ArtistBox';
import DesktopTopBanner from '@/components/app/DesktopTopBanner';
import LiveChatStack from '@/components/app/LiveChatStack';
import MobileRouteHeader from '@/components/app/MobileRouteHeader';
import NowPlaying from '@/components/app/NowPlaying';
import PlaylistModal from '@/components/app/PlaylistModal';
import EditProfileModal from '@/components/app/EditProfileModal';
import NotificationBell from '@/components/app/NotificationBell';
import SuperfansPanel from '@/components/app/SuperfansPanel';
import AnaCheckInPanel from '@/components/app/AnaCheckInPanel';
import AnaFlightPanel from '@/components/app/AnaFlightPanel';
import SameTrackToast from '@/components/app/SameTrackToast';
import PointsToast from '@/components/app/PointsToast';
import AppToast from '@/components/app/AppToast';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import HeartsCascade from '@/components/app/HeartsCascade';
import WaveReceiveOverlay from '@/components/app/WaveReceiveOverlay';
import MilestoneNotification from '@/components/app/MilestoneNotification';
import AchievementCelebration from '@/components/app/AchievementCelebration';
import MotionConfetti from '@/components/app/MotionConfetti';
import DailyMissionCelebration from '@/components/app/DailyMissionCelebration';
import SocialAchievementToast from '@/components/app/SocialAchievementToast';
import { useFanpointMilestones } from '@/hooks/useFanpointMilestones';
import BrainstormGate from '@/components/app/BrainstormGate';
import BrainstormPanel from '@/components/app/BrainstormPanel';
import SuperliveTrigger from '@/components/app/SuperliveTrigger';
import CollectiveListeningTrigger from '@/components/app/CollectiveListeningTrigger';
import ShowLiveTrigger from '@/components/app/ShowLiveTrigger';
import FindMyLoveTrigger from '@/components/app/FindMyLoveTrigger';
import SuperchatTrigger from '@/components/app/SuperchatTrigger';
import MapSimulationLayer from '@/components/app/MapSimulationLayer';
import MapPulses from '@/components/app/MapPulses';
import MapZoomIndicator from '@/components/app/MapZoomIndicator';
import SimulationHUD from '@/components/app/SimulationHUD';
import FanverseSearch from '@/components/app/FanverseSearch';
import FanpointsModal from '@/components/app/FanpointsModal';
import RankingStoreModal from '@/components/app/RankingStoreModal';
import { InviteFriendsModal } from '@/components/app/ArtistBox';
import ShowDayLayer from '@/components/app/ShowDayLayer';
import ShowDayPanel from '@/components/app/ShowDayPanel';
import LocationSync from '@/components/app/LocationSync';
import styles from './layout.module.css';

/**
 * Persistent shell for every `/app/*` route — Phase 3 of the
 * route refactor.
 *
 * Everything that should outlive a route change lives in this
 * file: the Globe (with desktop-persistent / mobile-conditional
 * mounting), TopBar, BottomNav, NowPlaying mini-bar, right-rail
 * secondary actions cluster (Notif / Playlist / Superfãs),
 * SuperchatTrigger, NotificationBell, PlaylistModal,
 * AnaCheckInPanel modal, plus every toast.
 *
 * Routes (children) just render their content inside `.mapLayer`
 * — typically a position:fixed panel that overlays the basemap.
 *
 * (The /app/select pre-app gate that used to bypass this shell
 * was retired alongside the universe-picker page; new visitors
 * auto-land on the Ana Castela default — see UniverseContext.)
 */

const Globe = dynamic(() => import('@/components/app/Globe'), { ssr: false });

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RankBandsProvider>
      <AppShellProvider>
        <Shell>{children}</Shell>
      </AppShellProvider>
    </RankBandsProvider>
  );
}

/**
 * Inner shell — split into its own component so we can call
 * `useAppShell()` (which requires the provider to be mounted
 * above us). Holds all the persistent JSX + the one or two
 * shell-level side-effects (Fanpoint milestones).
 */
function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const {
    chat,
    chatUnreadCount,
    onlineUserIds,
    activeOverlay,
    setActiveOverlay,
    setShowPlaylist,
    songIdx,
    setSongIdx,
    setPlayerExpanded,
    setPlayerSize,
    playerHidden,
    setPlayerHidden,
    showEditProfile,
    setShowEditProfile,
    anaModalPayload,
    closeAnaCheckIn,
    anaFlightModalPayload,
    closeAnaFlight,
    feedOpen,
    welcomeStage,
  } = useAppShell();

  // Helper pra wrappar elementos com fade controlado pelo
  // welcomeStage. Retorna a className combinada — opacity 0 +
  // pointer-events none quando o stage atual não cobre o
  // threshold. Default é 5 (sessão normal) → todos os
  // wrappers ficam ready desde o paint.
  const fadeClass = (threshold: number) =>
    welcomeStage >= threshold
      ? styles.welcomeFade
      : `${styles.welcomeFade} ${styles.welcomeFadeHidden}`;
  // Watches the viewer's Fanpoints balance for 100-multiple
  // crossings and dispatches `app:milestone-fp` so the
  // MilestoneNotification banner can pop globally.
  useFanpointMilestones();

  // NOTE: Antes havia um first-access guard que escondia o player
  // no primeiro acesso (flag "app:has-visited" em localStorage).
  // Revertido por feedback de produto: usuário recém-cadastrado
  // precisa ver o player imediatamente. Mantemos limpando a flag
  // antiga pra garantir que browsers que tinham o estado sujo
  // entrem no fluxo novo direto.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem('app:has-visited');
    } catch {
      /* localStorage indisponível (modo privado, quota) — sem efeito. */
    }
  }, []);

  // Globe mount strategy:
  //   - Desktop: always mounted (sits behind every route as
  //     ambient context, exactly like before the refactor).
  //   - Mobile: only on /app — every other route fully unmounts
  //     the WebGL canvas so GPU/RAM/battery are freed.
  const showGlobe = pathname === '/app' || !isMobile;
  const showPlaylist = activeOverlay === 'playlist';
  const showNotifications = activeOverlay === 'notifications';
  // Superfãs as a layer-on-top overlay (same shape as Playlist /
  // Notificações). Mobile keeps the route-based /app/ranking flow
  // for deep-linking + the BottomNav crown — only show as overlay
  // when we're NOT already sitting on that route, otherwise the
  // panel would double-mount with two instances competing.
  const showSuperfans =
    activeOverlay === 'superfans' && !pathname.startsWith('/app/ranking');

  // Chat detail = a specific conversation is open inside /app/chat.
  // When true on mobile, we hide the BottomNav + persistent header
  // chrome (ArtistBox pill, right-rail action cluster, Superchat
  // floater, NowPlaying / restore pill) so the LiveChatPanel can
  // take the full viewport and the on-screen keyboard never has to
  // fight the navbar for the input row. Desktop ignores this — the
  // chat panel is a 420px side rail there, nothing to hide.
  const chatDetailOpen =
    pathname.startsWith('/app/chat') && chat.activeId !== null;
  const hideShellChrome = chatDetailOpen && isMobile;
  /* Drawer de Chat ou Comunidades aberto (rotas /app/chat e
   * /app/comunidades). Agora que esses painéis viraram drawers
   * flutuantes (estilo Minha Conta, recuo 34px à direita), o dock
   * de conversas recentes ao lado vira redundância visual — some
   * enquanto o drawer está aberto. Per product feedback "não tem
   * porque a lista aparecer e ainda sim as conversas recentes
   * aparecerem ao lado". */
  const chatOrCommunityDrawerOpen =
    pathname.startsWith('/app/chat') || pathname.startsWith('/app/comunidades');

  const communityDrawerOpen = pathname.startsWith('/app/comunidades');
  /* Drawer de Chat (lista) aberto SEM uma conversa específica aberta. */
  const chatListDrawerOpen =
    pathname.startsWith('/app/chat') && !chatDetailOpen;
  /* Drawer de Chat (lista) OU de Comunidades aberto. Nesse estado, em
   * vez de sumir com o dock de conversas recentes (a "fricção de coisas
   * desaparecendo"), mantemos ele montado só que "atrás do blur"
   * (dimmed) — vira um fundo suave atrás do drawer. Vale pros dois boxes
   * per feedback "no box comunidade também devem aparecer os avatares de
   * conversas recentes ao fundo, com blur". */
  const drawerListOpen = chatListDrawerOpen || communityDrawerOpen;

  // Home = /app. Every other route is a "subpage" that, on mobile,
  // gets the MobileRouteHeader (back arrow + centered title + drag-
  // down) and HIDES the persistent Fanverse header chrome (ArtistBox
  // pill, right-rail action cluster, SuperchatTrigger). Per product
  // feedback the header should "ficar apenas na home" on mobile —
  // subpages already have their own back / title, so the persistent
  // chrome would just compete with that.
  const onHome = pathname === '/app';
  const hideMobileHeader = isMobile && !onHome;
  // Mobile route header — shown on every non-home /app route, but
  // NOT when chat detail is open (LiveChatPanel takes the whole
  // viewport there and has its own back arrow).
  const showMobileRouteHeader = isMobile && !onHome && !chatDetailOpen;

  return (
    <>
      {/* Globe — under everything, conditional. Placeholder painted
       *  behind so the cold-mount on /app doesn't flash a blank
       *  background while Mapbox bootstraps. */}
      <div className={styles.globePlaceholder} aria-hidden="true" />
      {showGlobe && <Globe />}

      {/* Sync headless de localização: captura/atualiza as coords de quem
       *  consentiu (LGPD) pra ele aparecer no mapa pros outros. Render
       *  null — restaura a captura que ficou órfã quando o LocateButton
       *  saiu da tela. */}
      <LocationSync />

      {/* Back to landing */}
      <Link href="/" className={styles.backBtn} aria-label="Voltar para início">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>

      {/* App shell (TopBar + map layer + BottomNav). Routes render
       *  inside `.mapLayer` via {children}. */}
      <div className={styles.shell}>
        {/* Véu lateral direito — DENTRO do .shell (que é um contexto de
         *  empilhamento próprio, z:55), junto do sino+avatar (z:200) e
         *  dos drawers (z:240). Aqui o veil (z:230) fica ATRÁS do drawer
         *  e à FRENTE do avatar, ofuscando a fração de avatar que aparece
         *  no recuo de 34px à direita. Se ficasse fora do shell (root),
         *  z:230 > shell z:55 e ele pintava NA FRENTE do drawer. Só
         *  desktop; no mobile a .userMenu some e o drawer é fullscreen. */}
        {!isMobile && chatOrCommunityDrawerOpen && (
          <div className={styles.chatDrawerVeil} aria-hidden="true" />
        )}
        {!hideShellChrome && (
          <div className={fadeClass(5)}>
            <TopBar
              onProfileOpen={() => router.push('/app/perfil')}
              /* "Editar perfil" no drawer abre o modal diretamente
               * (sem desviar pela tela /app/perfil) per product
               * feedback. O modal está montado abaixo, no shell,
               * pra ficar acessível independente da rota. */
              onEditProfileOpen={() => setShowEditProfile(true)}
              onDeleteAccountOpen={() => router.push('/app/perfil')}
            />
          </div>
        )}

        {/* Banner promocional fixo no topo (desktop-only, 640px
         *  com sombra dark). Internamente usa `useIsMobile()`
         *  pra retornar null no mobile, então não precisa de
         *  gate adicional aqui. */}
        {!hideShellChrome && (
          <div className={fadeClass(5)}>
            <DesktopTopBanner />
          </div>
        )}

        {/* Orb decorativo do left rail desktop foi removido per
         * product feedback "Remova o orbe que está na lateral do
         * mapa e mantenha apenas dentro do box Fanverse Ana
         * Castela". O FanverseCore continua dentro do ArtistBox
         * (header desktop) + MobileFanverseSheet (header mobile)
         * + MobileHomeChrome (avatar pequeno no topo do mobile).
         * O slot .orbSlot foi limpo do layout.module.css. */}

        {/* Mobile route header — back arrow + centered title +
         *  drag-down → /app. Shows on every non-home /app route
         *  on mobile; hidden on home, on desktop, and while a
         *  chat detail is open (LiveChatPanel has its own). */}
        {showMobileRouteHeader && <MobileRouteHeader />}

        <div className={styles.mapLayer}>
          {/* Right-rail cluster MOBILE-ONLY — abriga só o atalho
           * de "Conversas" (Send/paper-airplane) com o badge de
           * unreads. No desktop o cluster foi retirado per
           * product feedback "remova o ícone de mensagem do botão
           * '+' na lista lateral de chat" + "remova também o
           * ícone de Play": ambos os botões desktop (Send/Chat e
           * Play/Playlist) saíram, e o acesso ao chat fica via
           * LiveChatStack ("+" abaixo dos avatares) e ao
           * Playlist via NowPlaying mini-bar.
           *
           * No mobile o atalho de Chat segue aqui porque o
           * LiveChatStack tem footprint diferente (avatares menores
           * verticalmente) e o BottomNav já está cheio. */}
          {!hideShellChrome && !hideMobileHeader && isMobile && !feedOpen && (
            <div className={`${styles.topBar} ${fadeClass(5)}`}>
              <button
                type="button"
                className={`${styles.shortcutBtn} ${pathname.startsWith('/app/chat') ? styles.shortcutBtnActive : ''}`}
                onClick={() => {
                  if (pathname.startsWith('/app/chat')) {
                    router.push('/app');
                  } else {
                    router.push('/app/chat');
                  }
                }}
                aria-label={pathname.startsWith('/app/chat') ? 'Fechar conversas' : 'Conversas'}
                aria-pressed={pathname.startsWith('/app/chat')}
                title="Conversas"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.5 2.5L11 13M21.5 2.5L14.5 21.5L10.5 13L2 9L21.5 2.5z" />
                </svg>
                {chatUnreadCount > 0 && (
                  <span className={styles.shortcutBtnBadge} aria-hidden="true">
                    {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* NotificationBell — controlled, hidden trigger. The
           *  visible affordance is the bell button in the right
           *  rail above; it dispatches `app:open-notifications`
           *  which the shell provider translates into
           *  activeOverlay='notifications'. */}
          <NotificationBell
            hideTrigger
            open={showNotifications}
            onOpenChange={(next) => {
              if (next) setActiveOverlay('notifications');
              else
                setActiveOverlay((curr) =>
                  curr === 'notifications' ? null : curr,
                );
            }}
          />

          {/* Route content lands here. position:fixed panels work
           *  the same way they did before the refactor.
           *
           *  Wrapper .welcomeFade pra que tudo que vive nas pages
           *  (Feed, MockToastRotator notifications, BrainstormPanel,
           *  Superlive/CollectiveListening triggers, FloatingUsers,
           *  MobileHomeChrome) participe do reveal pós-globo. Sem
           *  esse wrapper, esses elementos ficavam visíveis durante
           *  o flyTo enquanto TopBar/ArtistBox/BottomNav fadeavam.
           *
           *  threshold=5 = "demais chrome" — entra no reveal único
           *  simultâneo controlado pelo html[data-welcome] removido
           *  via AppShellContext. */}
          <div className={fadeClass(5)}>{children}</div>
        </div>

        {!hideShellChrome && (
          <div className={fadeClass(4)}>
            <BottomNav />
          </div>
        )}

        {/* Dock de conversas recentes (avatares). Fica DENTRO do .shell
         *  de propósito: assim divide o mesmo contexto de empilhamento do
         *  veil (z:230) e do box de Chat/Comunidades (z:240). Antes vivia
         *  fora do .shell e, como .shell é z:55, o dock (z:200, root)
         *  pintava NA FRENTE do box (z:240 ficava "preso" no z:55 do
         *  shell) e os avatares apareciam por cima da área do box. Dentro
         *  do shell: dock(200) < veil(230) < box(240) → o box cobre o
         *  dock; os avatares só aparecem na faixa lateral, atrás do blur.
         *
         *  `chatDetailOpen` esconde o dock (a conversa aberta cobre as
         *  miniaturas). Com o drawer de Chat/Comunidades aberto ele fica
         *  `dimmed` (borrado/esmaecido) atrás do box. */}
        {!hideShellChrome && !hideMobileHeader && !chatDetailOpen && (
          <div className={fadeClass(5)}>
            <LiveChatStack
              conversations={chat.conversations}
              activeId={chat.activeId}
              onlineUserIds={onlineUserIds}
              onOpen={(conversationId) => {
                chat.open(conversationId);
                router.push('/app/chat');
              }}
              onOpenAll={() => router.push('/app/chat')}
              totalUnreadCount={chatUnreadCount}
              dimmed={drawerListOpen && !isMobile}
            />
          </div>
        )}
      </div>

      {/* ArtistBox (Fanverse identity + missions panel) — on
       *  desktop it stays persistent across every /app/* route so
       *  the Fanpoints + entry to the benefits drawer stay visible
       *  on chat, comunidades, perfil, etc. On mobile per product
       *  feedback it lives ONLY on home (/app) — subpages have the
       *  MobileRouteHeader instead. Also always hidden when a chat
       *  detail is open. */}
      {!hideShellChrome && !hideMobileHeader && (
        <div className={fadeClass(2)}>
          <ArtistBox />
        </div>
      )}

      {/* (Dock de conversas recentes movido pra DENTRO do .shell — ver
       *  comentário lá em cima. Ficava aqui fora e pintava por cima do
       *  box de Chat por causa do contexto de empilhamento do .shell.) */}

      {/* SuperchatTrigger pill (top-right floater) was removed
       *  per product feedback "Remova o botão Entre no Superchat
       *  e inclua esse link dentro do menu ao abrir clicando na
       *  imagem lateral do usuário". The Superchat link now lives
       *  inside the TopBar's user-avatar drawer menu — see the
       *  Superchat / "Entre no Superchat" entry in TopBar.tsx. */}

      {/* NowPlaying mini-bar — on desktop it persists across every
       *  route so the user can keep playing while reading chat /
       *  comunidade. On mobile per product feedback the player
       *  lives ONLY on home (/app); every subpage has its own
       *  surface to focus on (chat composer, leaderboard, etc.)
       *  and a docked player there competes with their content +
       *  the BottomNav gradient scrim. When dismissed, the restore
       *  pill follows the same visibility rule. */}
      {/* Player aparece no primeiro acesso também — feedback de
       *  produto reverteu o gate anterior que escondia o player
       *  pra usuários recém-cadastrados (issue: "usuário que
       *  acabou de se cadastrar não está aparecendo o player").
       *  As demais regras (hideShellChrome em chat detail mobile,
       *  hideMobileHeader em subpage mobile) seguem valendo. */}
      {!hideShellChrome && !hideMobileHeader && (
        <div className={fadeClass(3)}>
          {playerHidden ? (
            <button
              type="button"
              className={styles.playerRestorePill}
              onClick={() => setPlayerHidden(false)}
              aria-label="Mostrar player"
              title="Mostrar player"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3v8.5a2.5 2.5 0 1 1-1.6-2.3" />
                <path d="M6 3l7-1.5v8.5a2.5 2.5 0 1 1-1.6-2.3" />
              </svg>
            </button>
          ) : (
            <NowPlaying
              onExpandChange={setPlayerExpanded}
              onSizeChange={setPlayerSize}
              songIdx={songIdx}
              onSongIdxChange={setSongIdx}
              onOpenPlaylist={() => setShowPlaylist(true)}
              onDismiss={() => setPlayerHidden(true)}
            />
          )}
        </div>
      )}

      <PlaylistModal
        open={showPlaylist}
        onClose={() => setShowPlaylist(false)}
        currentIdx={songIdx}
        onSelect={setSongIdx}
      />

      {/* Edit-profile modal — agora vive no shell pra que clicar
       *  "Editar perfil" no drawer da TopBar abra o modal direto,
       *  sem desviar pela tela /app/perfil. O botão "Editar perfil"
       *  do ProfilePanel (dentro de /app/perfil) também consome o
       *  mesmo state via AppShellContext, então só existe um mount
       *  ativo no app. */}
      <EditProfileModal
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      {/* Superfãs as a layered overlay — desktop right-rail uses
       *  this path instead of router.push('/app/ranking') so the
       *  Feed (and anything else on /app/page.tsx) stays mounted
       *  underneath. The route version is still available for
       *  mobile BottomNav + deep links; we guard the overlay
       *  against double-mounting via `showSuperfans` excluding the
       *  /app/ranking pathname. */}
      {showSuperfans && (
        <SuperfansPanel
          open
          onClose={() =>
            setActiveOverlay((curr) =>
              curr === 'superfans' ? null : curr,
            )
          }
        />
      )}

      {/* Ana check-in modal — opens when the user clicks a pin on
       *  the globe. State + scheduler live in AppShellProvider. */}
      <AnaCheckInPanel
        payload={anaModalPayload}
        onClose={closeAnaCheckIn}
      />

      {/* Tour Portugal flight modal — opens when the user clicks
       *  the airplane marker on the great-circle path. The flight
       *  state is published every minute by AppShellProvider so the
       *  modal's progress bar + hours-remaining stay live while
       *  open. */}
      <AnaFlightPanel
        payload={anaFlightModalPayload}
        onClose={closeAnaFlight}
      />

      {/* "Hoje tem show" — feature pra TODOS os usuários (fora do
       *  BrainstormGate, sem flag). ShowDayLayer pinta o marker da
       *  Fire Arena no mapa (subscribeMapInstance — sobrevive a
       *  remounts do Globe no mobile); ShowDayPanel abre via
       *  globeStore.openShowDay() / CustomEvent 'app:open-show-day'
       *  com o chat simulado + lista de presentes. */}
      <ShowDayLayer />
      <ShowDayPanel />

      {/* Persistent toasts — render at the shell level so rewards,
       *  achievements, milestones, and "X listening the same
       *  track" all surface regardless of which route the user is
       *  on. */}
      <SameTrackToast />
      <PointsToast />
      <AppToast />
      <ConfirmDialog />
      <MilestoneNotification />
      <AchievementCelebration />
      {/* MotionConfetti — sink global pro confetti motion/react.
       *  Escuta CustomEvent('app:motion-confetti'); todos os
       *  callers (AchievementCelebration, FeedCelebration,
       *  DailyMissionCelebration) disparam via fireMotionConfetti().
       *  Substitui o canvas-confetti antigo. */}
      <MotionConfetti />
      {/* Daily mission completion — observa transições done=false
       *  → done=true e dispara confetti motion. Sem UI própria. */}
      <DailyMissionCelebration />
      {/* SocialAchievementToast e HeartsCascade desmontados per
       *  product feedback (opção B "Equilibrado"): manter só
       *  AchievementCelebration em marcos de 500k + o overlay
       *  simples "X mandou corações". O toast de marcos de OUTROS
       *  usuários e a cascata de corações caindo na tela ficam
       *  silenciados pra reduzir ruído visual. Componentes
       *  continuam no codebase — basta restaurar os mounts pra
       *  ligar de novo. */}
      {/* <SocialAchievementToast /> */}
      {/* <HeartsCascade /> */}
      {/* Companion overlay to HeartsCascade — paints a soft
       *  black dim + a centered "<sender> enviou corações para
       *  você" message with the sender's name as a clickable
       *  Link to `/app/u/[id]`. Only renders when the cascade
       *  event carries a sourceName (i.e., a real socket-driven
       *  wave from another user), so the mock rotator's
       *  detail-less bursts don't trigger it. Per product
       *  feedback "a tela do usuário que receber, além dos
       *  corações caindo, deverá ficar com uma camada preta". */}
      <WaveReceiveOverlay />

      {/* Fanverse Search — overlay "Analisando atividade do mundo"
       *  disparado pelo clique no orbe FanverseCore. Self-mounting:
       *  ouve `app:open-fanverse-search` global e renderiza
       *  null/overlay com base em estado interno. Mantido no shell
       *  pra ficar disponível em qualquer rota /app/*. */}
      <FanverseSearch />

      {/* Fanpoints modal — abre via `app:open-fanpoints` (dispatched
       *  pelo link "Minhas conquistas" da tab Superfãs do ArtistBox).
       *  Self-mounting: ouve o evento global e renderiza overlay
       *  com 4 tabs (Conquistas/Fanpoints/Atividade/Como Trocar). */}
      <FanpointsModal />

      {/* Modal "Ranking completo + Loja" — abre via
       *  `app:open-ranking-store` (detail.screen 'ranking'|'loja').
       *  Disparado pelo "Ver mais" da aba Superfãs (Ranking) e pelo
       *  ícone Loja. Self-mounting: ouve o evento global e renderiza
       *  o modal full-screen (mock). */}
      <RankingStoreModal />

      {/* Modal "Convide seus amigos" (loop viral / referral) —
       *  abre via `app:open-invite` (dispatched pelo drawer do
       *  TopBar + hamburger do BottomNav). Self-mounting: ouve o
       *  evento global e renderiza o link de convite + stats. */}
      <InviteFriendsModal />

      {/* ── Brainstorm + Map Simulation ──
       *
       *  Subiu pro shell per product feedback "quando o toggle de
       *  mostrar a feature de brainstorm está ativada, nem sempre
       *  é visível no mapa conforme eu clico em feed, comunidade,
       *  chat. Se ativado, deve sempre aparecer. Se desativado,
       *  não deve aparecer".
       *
       *  Antes ficava em /app/page.tsx (mount só em /app), então
       *  navegar pra subrota desmontava tudo. Agora persiste em
       *  todo /app/*, com o gate sendo apenas:
       *    - Toggle `DISPLAY_KEYS.brainstormTriggers` (ícones)
       *    - Flag interna `flags.mapSimulation` (features)
       *    - `hideShellChrome` em chat detail mobile (LiveChatPanel
       *      cobre o viewport, então não faz sentido pintar ícones
       *      do brainstorm em cima do chat).
       *
       *  Mobile sem Globe (subrota) — MapSimulationLayer subscribe
       *  via globeStore: quando Globe desmonta, attach(null) limpa
       *  layers; quando remonta, attach(map) reanexa. Sem leak. */}
      {!hideShellChrome && (
        <div className={fadeClass(5)}>
          <BrainstormGate>
            <BrainstormPanel />
            <SuperliveTrigger />
            <CollectiveListeningTrigger />
            <ShowLiveTrigger />
            <SuperchatTrigger />
            <FindMyLoveTrigger />
          </BrainstormGate>
          <MapSimulationLayer />
          <MapPulses />
          <SimulationHUD />
          <MapZoomIndicator />
        </div>
      )}
      {/* FireArenaBanner (countdown do lançamento Fire Arena)
       *  REMOVIDO da home per product feedback "remova o banner
       *  do novo album". O componente continua existindo em
       *  src/components/app/FireArenaBanner.tsx — pra
       *  reativá-lo, basta re-importar e renderizar dentro de
       *  <div className={fadeClass(5)}>...</div> aqui. */}
    </>
  );
}
