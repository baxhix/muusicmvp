'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import TopBar from '@/components/app/TopBar';
import FilterTabs from '@/components/app/FilterTabs';
import LiveChatStack from '@/components/app/LiveChatStack';
import LiveChatPanel from '@/components/app/LiveChatPanel';
import ConversationsSidebar from '@/components/app/ConversationsSidebar';
import GroupMembersPanel from '@/components/app/GroupMembersPanel';
import ArtistBox from '@/components/app/ArtistBox';
import UserPicker from '@/components/app/UserPicker';
import NowPlaying from '@/components/app/NowPlaying';
import ListeningTogether from '@/components/app/ListeningTogether';
import FloatingUsers from '@/components/app/FloatingUsers';
import BottomNav from '@/components/app/BottomNav';
import FeedPanel from '@/components/app/FeedPanel';
import ProfilePanel, { type ProfileUser } from '@/components/app/ProfilePanel';
import SuperfansPanel from '@/components/app/SuperfansPanel';
// SideBar removed from this screen — logo strip is no longer rendered.
import Onboarding from '@/components/app/Onboarding';
// LocateButton removed from this screen — geo prompt is no longer rendered.
import EditProfileModal from '@/components/app/EditProfileModal';
import DeleteAccountModal from '@/components/app/DeleteAccountModal';
import PlaylistModal from '@/components/app/PlaylistModal';
import NotificationBell from '@/components/app/NotificationBell';
import HeroOrb from '@/components/app/HeroOrb/HeroOrb';
import SuperchatTrigger from '@/components/app/SuperchatTrigger';
import SuperchatPanel from '@/components/app/SuperchatPanel';
import SameTrackToast from '@/components/app/SameTrackToast';
import AchievementCelebration from '@/components/app/AchievementCelebration';
import SocialAchievementToast from '@/components/app/SocialAchievementToast';

import { useChatLiveWithFakes } from '@/hooks/useChatLiveWithFakes';
import {
  FAKE_ANA_CONVERSATION_ID,
  FAKE_ANA_NOW_PLAYING,
  FAKE_ANA_USER_ID,
  FAKE_CENTRAL_CONVERSATION_ID,
  FAKE_CENTRAL_NOW_PLAYING,
  FAKE_CENTRAL_USER_ID,
} from '@/lib/fakeAna';
import { useLocationSync } from '@/hooks/useLocationSync';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTracksCatalog } from '@/hooks/useTracksCatalog';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUniverse } from '@/lib/universe/UniverseContext';
import { globeStore } from '@/lib/globeStore';
import { useRouter } from 'next/navigation';

import styles from './page.module.css';

const Globe = dynamic(() => import('@/components/app/Globe'), { ssr: false });

export default function AppPage() {
  const { user: authUser } = useAuth();
  const { universeId, hydrated: universeHydrated } = useUniverse();
  const router = useRouter();
  const chat = useChatLiveWithFakes();

  // Universe gate: once the localStorage read has resolved and the
  // user is authenticated, redirect to the selection screen if they
  // haven't picked a universe yet. `hydrated` is critical — without
  // it we'd bounce to /select on every fresh load before the persisted
  // choice is read.
  useEffect(() => {
    if (!universeHydrated) return;
    if (!authUser) return; // unauthenticated path handled elsewhere
    if (!universeId) {
      router.replace('/app/select');
    }
  }, [universeHydrated, authUser, universeId, router]);
  const { users: liveUsers, totalRegistered } = useLiveUsers();
  // Stable Set of currently-online user ids, passed to LiveChatStack
  // so each avatar can render a green/gray presence dot. Memoized so
  // the child doesn't see a new reference on every render — only
  // when the actual roster changes (by ids list).
  const onlineUserIds = useMemo(
    // Both fake contacts (Ana + Central) always read as online — VIP
    // affordances, otherwise their dashes would misleadingly look
    // gray when they're constantly active.
    () =>
      new Set([
        ...liveUsers.map((u) => u.id),
        FAKE_ANA_USER_ID,
        FAKE_CENTRAL_USER_ID,
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveUsers.map((u) => u.id).join('|')],
  );
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [playerSize, setPlayerSize] = useState<'mini' | 'horizontal' | 'expanded' | 'video'>('mini');
  const [showProfile, setShowProfile] = useState(false);
  /**
   * Which user the profile panel currently displays. `null` means
   * "the logged-in user" — that's the default whenever the panel is
   * opened via the navbar/topbar. Set to another id when the user
   * clicks a presence pin on the globe; the ProfilePanel then renders
   * that user's data (fetched via useUserProfile below) with the
   * other-user button set (Acenar / Enviar mensagem).
   */
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  // Single state for "ranking-style" panel — both the Ranking button in
  // the top bar and the crown icon in the bottom nav route here. Uses the
  // SuperfansPanel UI fed with real /api/ranking data.
  const [showSuperfans, setShowSuperfans] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showSuperchat, setShowSuperchat] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  // Separate from showUserPicker because the UserPicker renders in
  // a different mode (with name field + multi-select + Create CTA).
  // Both pickers share the same modal component, just keyed by which
  // flag is true.
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  // Members roster for the currently-active group. Driven by the
  // kebab "Ver membros" item; closed via X or after the user leaves.
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  // When the kebab "Adicionar membro" trigger is fired we open the
  // SingleProps UserPicker variant. Reuses the same modal that
  // starts DMs; on pick we POST /members instead of openDmWith.
  const [addingMemberToGroup, setAddingMemberToGroup] = useState<string | null>(null);
  // Full-list conversations drawer — opens from the dock's "ver
  // tudo" overflow trigger. The dock itself only shows the latest
  // few DMs so the user can reach the rest without scrolling.
  const [showConversationsSidebar, setShowConversationsSidebar] = useState(false);
  const [songIdx, setSongIdx] = useState(0);

  // Asks for browser geolocation on first authenticated load (per session).
  // Server snaps to city centroid + per-user jitter; exact GPS isn't stored.
  useLocationSync();

  // Current track of the logged-in player — drives the audio-bars indicator
  // on the "Você" badge. Source of truth is `songIdx` controlled here and
  // passed into <NowPlaying />.
  const { tracks: catalog } = useTracksCatalog();
  const currentTrack = catalog[songIdx] ?? null;

  // Drop a "Você" badge on the Globe at the user's persisted (jittered)
  // city-level location whenever lat/lng, avatar OR the current track
  // change. Cleans the marker on logout. The Globe registers its handler
  // on map load, so this effect re-runs once authUser arrives.
  useEffect(() => {
    if (authUser?.lat != null && authUser?.lng != null) {
      globeStore.setUserLocation({
        coords: { lat: authUser.lat, lng: authUser.lng },
        avatarUrl: authUser.avatarUrl,
        name: 'Você',
        trackTitle: currentTrack?.title ?? null,
        trackArtist: currentTrack?.artist ?? null,
      });
    } else {
      globeStore.setUserLocation(null);
    }
  }, [
    authUser?.lat,
    authUser?.lng,
    authUser?.avatarUrl,
    currentTrack?.title,
    currentTrack?.artist,
  ]);

  // Render every other online user with location as a badge on the globe.
  // The server-side per-user jitter (~4 km within the city centroid) keeps
  // overlapping avatars visually separated when zoomed in. We filter out
  // the current user (already shown as the "Você" badge above) and any
  // users without coords.
  useEffect(() => {
    const mapped = liveUsers
      .filter((u) => u.lat != null && u.lng != null && u.id !== authUser?.id)
      .map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        lat: u.lat as number,
        lng: u.lng as number,
        trackTitle: u.nowPlaying?.title ?? null,
        trackArtist: u.nowPlaying?.artist ?? null,
      }));
    globeStore.setLiveUsers(mapped);
  }, [liveUsers, authUser?.id]);

  // Push the total registered head-count to the globe so it can scatter
  // ambient "fan presence" dots around Paraná — independent from the
  // live presence markers above, which only show users currently online.
  useEffect(() => {
    globeStore.setTotalRegistered(totalRegistered);
  }, [totalRegistered]);

  // Wire pin-click on the globe → open that user's profile.
  useEffect(() => {
    globeStore.registerOpenUserProfile((userId) => {
      setViewingUserId(userId);
      setShowProfile(true);
    });
  }, []);

  // Fetch the full profile (identity + fanpoints + streams + now-playing)
  // for whichever user the panel is showing. We fetch own AND other —
  // both routes through the same endpoint so the same data shape feeds
  // both the own-profile and other-user-profile renders.
  const profileTargetId =
    viewingUserId ?? (showProfile ? authUser?.id ?? null : null);
  const { profile: viewingProfile } = useUserProfile(profileTargetId);

  // Build the ProfileUser shape consumed by ProfilePanel. When the
  // remote profile has loaded, we use its values (fanpoints, streams,
  // city, etc.); otherwise we fall back to the local auth record so the
  // first paint isn't empty. The flag `isOwnProfile` is derived from
  // whether viewingUserId points at the logged-in user.
  const isOwnProfile =
    viewingUserId === null || viewingUserId === (authUser?.id ?? '__never__');
  const displayedUser: ProfileUser = viewingProfile
    ? {
        id: viewingProfile.id,
        name:
          viewingProfile.name?.trim() ||
          viewingProfile.email?.split('@')[0] ||
          'Anônimo',
        city: viewingProfile.city ?? '—',
        state: viewingProfile.countryCode ?? '',
        streams: viewingProfile.streams,
        fanpoints: viewingProfile.fanpoints,
        img:
          viewingProfile.avatarUrl ??
          `https://i.pravatar.cc/72?u=${viewingProfile.id}`,
        isOnline: viewingProfile.isOnline,
        nowPlaying: viewingProfile.nowPlaying
          ? {
              title: viewingProfile.nowPlaying.title,
              artist: viewingProfile.nowPlaying.artist,
            }
          : undefined,
      }
    : {
        id: authUser?.id ?? 'me',
        name: authUser?.name ?? authUser?.email?.split('@')[0] ?? 'Você',
        city: authUser?.city ?? '—',
        state: authUser?.countryCode ?? '',
        streams: 0,
        fanpoints: 0,
        img:
          authUser?.avatarUrl ??
          `https://i.pravatar.cc/72?u=${authUser?.id ?? 'me'}`,
        isOnline: true,
        nowPlaying: undefined,
      };

  const activeConversation =
    chat.conversations.find((c) => c.id === chat.activeId) ?? null;

  // Pull the live now-playing for the OTHER user in the active DM —
  // drives the "now playing" line in the chat panel header. When the
  // user is offline or hasn't been seen with a track, this is null;
  // LiveChatPanel falls back to a deterministic mock for that case.
  // SPECIAL CASES: the fake Ana + Central conversations always show
  // their featured tracks regardless of presence.
  const activeOtherNowPlaying = (() => {
    if (activeConversation?.id === FAKE_ANA_CONVERSATION_ID) {
      return FAKE_ANA_NOW_PLAYING;
    }
    if (activeConversation?.id === FAKE_CENTRAL_CONVERSATION_ID) {
      return FAKE_CENTRAL_NOW_PLAYING;
    }
    const otherId = activeConversation?.otherUser?.id;
    if (!otherId) return null;
    const liveOther = liveUsers.find((u) => u.id === otherId);
    if (!liveOther?.nowPlaying) return null;
    return {
      title: liveOther.nowPlaying.title,
      artist: liveOther.nowPlaying.artist,
    };
  })();

  // Superchat lives in the same conversation list as DMs (type='group').
  // Pluck it so the trigger pill can show its unread count badge and the
  // panel can call markRead through useChatLive.
  const superchat = chat.conversations.find((c) => c.type === 'group') ?? null;

  return (
    <>
      <Globe />

      {/* Back to landing */}
      <Link href="/" className={styles.backBtn} aria-label="Voltar para início">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>

      {/* App Shell */}
      <div className={styles.shell}>
        <TopBar
          onProfileOpen={() => setShowProfile(true)}
          onEditProfileOpen={() => setShowEditProfile(true)}
          onDeleteAccountOpen={() => setShowDeleteAccount(true)}
        />
        {/* <StatusToggle /> */}

        {/* Map Layer */}
        <div className={styles.mapLayer}>
          {/* Top center row: filter pills + Superchat CTA + notifications
              side-by-side. Ranking (Superfãs) is reachable via the
              BottomNav crown icon — no longer duplicated up here. */}
          <div className={styles.topBar}>
            <FilterTabs />
            <SuperchatTrigger
              onClick={() => setShowSuperchat(true)}
              unreadCount={superchat?.unreadCount ?? 0}
            />
            {/* Decorative particle orb — sits where the bell icon
                used to be visible. Premium ambient signal that the
                platform is "alive" even when there are no
                notifications to surface. Purely visual; pointer
                events stay on for future hover affordances. */}
            <HeroOrb size={70} />
            {/* NotificationBell stays mounted (its panel + event
                listener are needed) but renders without the trigger
                glyph. The visible entry point now lives in the
                BottomNav notifications slot, which dispatches the
                'app:open-notifications' CustomEvent the bell
                listens to. */}
            <NotificationBell hideTrigger />
          </div>

          {/* Floating overlay of every real online user — anchored to
              deterministic screen positions so the roster is always visible
              regardless of how the globe is rotated. Real lat/lng markers
              are owned by <Globe /> via globeStore.setLiveUsers. */}
          <FloatingUsers />
        </div>

        <BottomNav
          /* Music icon → PlaylistModal (registered track catalog).
             Crown icon → SuperfansPanel (Ranking).
             Chat icon  → Superchat panel.
             Profile icon → ProfilePanel. */
          onPlaylistOpen={() => setShowPlaylist(true)}
          onSuperfansOpen={() => setShowSuperfans(true)}
          onProfileOpen={() => setShowProfile(true)}
          onSuperchatOpen={() => setShowSuperchat(true)}
        />
      </div>

      {/* Now playing — fora do shell pra ficar acima do FeedPanel no mobile */}
      <NowPlaying
        onExpandChange={setPlayerExpanded}
        onSizeChange={setPlayerSize}
        songIdx={songIdx}
        onSongIdxChange={setSongIdx}
        onOpenPlaylist={() => setShowPlaylist(true)}
      />

      {/* SideBar (left-edge logo strip) intentionally removed —
          product feedback wanted the top-left corner cleaner. The
          universe switcher that used to live there moved into the
          TopBar user drawer already, so there's no orphaned action. */}

      {/* Artist identity box — fixed top-left card showing the
          current Fanverse + the user's daily missions panel.
          Self-positioned (top:42 / left:68); collapses to a header
          row + progress bar by default, expands to reveal the
          missions list when clicked. */}
      <ArtistBox />

      <LiveChatStack
        conversations={chat.conversations}
        activeId={chat.activeId}
        onlineUserIds={onlineUserIds}
        onOpen={chat.open}
        // The "+" trigger on the dock now opens the full conversations
        // drawer; the drawer carries the search + its own "+" that
        // pops the UserPicker for actually starting a new chat.
        onAddClick={() => setShowConversationsSidebar(true)}
      />
      <ConversationsSidebar
        open={showConversationsSidebar}
        conversations={chat.conversations}
        activeId={chat.activeId}
        onlineUserIds={onlineUserIds}
        onClose={() => setShowConversationsSidebar(false)}
        onOpenConversation={chat.open}
        onNewConversation={() => {
          setShowConversationsSidebar(false);
          setShowUserPicker(true);
        }}
        onNewGroup={() => {
          setShowConversationsSidebar(false);
          setShowGroupPicker(true);
        }}
      />
      <LiveChatPanel
        conversation={activeConversation}
        messages={chat.messages}
        loading={chat.loadingMessages}
        otherNowPlaying={activeOtherNowPlaying}
        onClose={chat.close}
        onSend={chat.send}
        onReact={chat.react}
        onOpenMembers={() => setShowGroupMembers(true)}
        onLeaveGroup={async () => {
          // Direct call — confirm + DELETE the caller's membership.
          // After success, close the chat panel so the user lands
          // back on the map / feed.
          if (!activeConversation || !authUser) return;
          if (!window.confirm('Sair desse grupo? Você não receberá mais mensagens dele.')) return;
          try {
            const res = await fetch(
              `/api/conversations/${activeConversation.id}/members/${authUser.id}`,
              { method: 'DELETE', credentials: 'include' },
            );
            if (!res.ok) {
              window.alert('Não foi possível sair do grupo.');
              return;
            }
            chat.close();
          } catch (err) {
            console.error('leave group failed:', err);
          }
        }}
      />

      {/* Members roster — opened from the kebab "Ver membros" entry
          when the active conversation is a group. */}
      <GroupMembersPanel
        open={showGroupMembers && activeConversation?.type === 'group'}
        conversationId={activeConversation?.type === 'group' ? activeConversation.id : null}
        currentUserId={authUser?.id ?? ''}
        myRole={activeConversation?.myRole ?? null}
        onClose={() => setShowGroupMembers(false)}
        onAddMember={() => {
          if (!activeConversation) return;
          setAddingMemberToGroup(activeConversation.id);
        }}
        onLeft={() => {
          // After the user leaves: close everything + refresh list
          setShowGroupMembers(false);
          chat.close();
          void chat.refreshConversations();
        }}
        onImageUpdated={() => {
          // Pull a fresh conversations list so the dock + sidebar +
          // chat header pick up the new imageUrl. The members panel
          // itself doesn't need a refresh since the image isn't in
          // its payload.
          void chat.refreshConversations();
        }}
      />
      <UserPicker
        open={showUserPicker}
        onClose={() => setShowUserPicker(false)}
        onPick={(uid) => chat.openDmWith(uid)}
      />
      <UserPicker
        open={showGroupPicker}
        mode="group"
        onClose={() => setShowGroupPicker(false)}
        onCreateGroup={async ({ name, memberIds }) => {
          await chat.createGroup({ name, memberIds });
          setShowGroupPicker(false);
        }}
      />

      {/* "Adicionar membro" — single-pick UserPicker that POSTs to
          /api/conversations/:id/members. Open only while
          addingMemberToGroup carries the active conversation id. */}
      <UserPicker
        open={addingMemberToGroup !== null}
        onClose={() => setAddingMemberToGroup(null)}
        onPick={async (uid) => {
          const convId = addingMemberToGroup;
          if (!convId) return;
          try {
            const res = await fetch(
              `/api/conversations/${convId}/members`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: uid }),
              },
            );
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              window.alert(
                data.error === 'user_not_found'
                  ? 'Usuário não encontrado.'
                  : 'Não foi possível adicionar o membro.',
              );
              return;
            }
            // Refresh the conversations list so the dock/sidebar
            // pick up the new memberCount + any related metadata.
            // The members panel itself re-fetches on open via its
            // useEffect; toggle to force a fresh fetch.
            setAddingMemberToGroup(null);
            setShowGroupMembers(false);
            setTimeout(() => setShowGroupMembers(true), 30);
            void chat.refreshConversations();
          } catch (err) {
            console.error('add member failed:', err);
          }
        }}
      />
      <ListeningTogether playerExpanded={playerExpanded} playerSize={playerSize} />

      {showProfile
        ? <ProfilePanel
            user={displayedUser}
            isOwnProfile={isOwnProfile}
            onClose={() => {
              setShowProfile(false);
              // Reset to "own" so the next navbar open lands on the
              // logged user, not the last-viewed other user.
              setViewingUserId(null);
            }}
            onEditProfile={() => setShowEditProfile(true)}
            onOpenMessages={() => setShowSuperchat(true)}
            onSendMessage={(uid) => {
              setShowProfile(false);
              setViewingUserId(null);
              chat.openDmWith(uid);
            }}
            onWave={(uid, label) => {
              // For now, only client-side acknowledgment — backend
              // event will land in a follow-up. The toast lives on
              // the chat thread surface so the user sees it without
              // an additional UI primitive.
              console.log(`wave → ${uid} (${label})`);
            }}
            onReport={(uid, label) => {
              console.log(`report → ${uid} (${label})`);
            }}
          />
        : <FeedPanel />
      }

      <SuperfansPanel
        open={showSuperfans}
        onClose={() => setShowSuperfans(false)}
      />

      <EditProfileModal
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      <DeleteAccountModal
        open={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        userName="Ana Beatriz"
      />

      <PlaylistModal
        open={showPlaylist}
        onClose={() => setShowPlaylist(false)}
        currentIdx={songIdx}
        onSelect={setSongIdx}
      />

      {/* LocateButton (bottom-left geolocation pill) removed per
          product feedback — it competed with the player for the
          bottom-left corner and most users now share location at
          onboarding. Re-add via this same spot if it comes back. */}

      {/* NotificationBell + SuperchatTrigger are rendered inline inside the
          topBar so they don't overlap the username at the top-right. The
          SuperchatPanel that they open stays here so it overlays everything. */}
      <SuperchatPanel
        open={showSuperchat}
        onClose={() => setShowSuperchat(false)}
        onMarkRead={() => {
          if (superchat) void chat.markRead(superchat.id);
        }}
      />
      {/* Ranking (SuperfansPanel) opens via the BottomNav crown icon
          — the inline RankingButton that used to sit in the topBar
          row was removed; the panel below is what actually opens. */}

      {/* Floating queue of "X is listening to the same song" notifications,
          driven by socket `notify:new` events of kind 'same_track'. Each
          toast holds 6s, then fades out. */}
      <SameTrackToast />

      {/* Self-celebration when the logged-in user crosses a point
          milestone — confetti + centered congrats line, ~7s. */}
      <AchievementCelebration />

      {/* Social proof — small toast when ANY user crosses a milestone. */}
      <SocialAchievementToast />

      <Onboarding />
    </>
  );
}
