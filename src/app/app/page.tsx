'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import TopBar from '@/components/app/TopBar';
import FilterTabs from '@/components/app/FilterTabs';
import LiveChatStack from '@/components/app/LiveChatStack';
import LiveChatPanel from '@/components/app/LiveChatPanel';
import ConversationsSidebar from '@/components/app/ConversationsSidebar';
import UserPicker from '@/components/app/UserPicker';
import NowPlaying from '@/components/app/NowPlaying';
import ListeningTogether from '@/components/app/ListeningTogether';
import FloatingUsers from '@/components/app/FloatingUsers';
import BottomNav from '@/components/app/BottomNav';
import FeedPanel from '@/components/app/FeedPanel';
import ProfilePanel, { type ProfileUser } from '@/components/app/ProfilePanel';
import SuperfansPanel from '@/components/app/SuperfansPanel';
import SideBar from '@/components/app/SideBar';
import Onboarding from '@/components/app/Onboarding';
import LocateButton from '@/components/app/LocateButton';
import EditProfileModal from '@/components/app/EditProfileModal';
import DeleteAccountModal from '@/components/app/DeleteAccountModal';
import PlaylistModal from '@/components/app/PlaylistModal';
import NotificationBell from '@/components/app/NotificationBell';
import SuperchatTrigger from '@/components/app/SuperchatTrigger';
import SuperchatPanel from '@/components/app/SuperchatPanel';
import RankingButton from '@/components/app/RankingButton';
import SameTrackToast from '@/components/app/SameTrackToast';
import AchievementCelebration from '@/components/app/AchievementCelebration';
import SocialAchievementToast from '@/components/app/SocialAchievementToast';

import { useChatLiveWithFakes } from '@/hooks/useChatLiveWithFakes';
import {
  FAKE_ANA_CONVERSATION_ID,
  FAKE_ANA_NOW_PLAYING,
  FAKE_ANA_USER_ID,
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
    // The fake Ana Castela contact always reads as online — she's
    // the "always-on" VIP affordance, otherwise her dash would
    // misleadingly look gray.
    () => new Set([...liveUsers.map((u) => u.id), FAKE_ANA_USER_ID]),
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
  // SPECIAL CASE: the fake Ana Castela conversation always shows the
  // featured launch track, regardless of presence.
  const activeOtherNowPlaying = (() => {
    if (activeConversation?.id === FAKE_ANA_CONVERSATION_ID) {
      return FAKE_ANA_NOW_PLAYING;
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
          {/* Top center row: filter pills + Ranking + Superchat + Notifications
              side-by-side so nothing overlaps the username at the top-right. */}
          <div className={styles.topBar}>
            <FilterTabs />
            <RankingButton onClick={() => setShowSuperfans(true)} />
            <SuperchatTrigger
              onClick={() => setShowSuperchat(true)}
              unreadCount={superchat?.unreadCount ?? 0}
            />
            <NotificationBell />
          </div>

          {/* Floating overlay of every real online user — anchored to
              deterministic screen positions so the roster is always visible
              regardless of how the globe is rotated. Real lat/lng markers
              are owned by <Globe /> via globeStore.setLiveUsers. */}
          <FloatingUsers />
        </div>

        <BottomNav
          /* Crown icon → SuperfansPanel (Ranking).
             Chat icon  → Superchat panel.
             Profile icon → ProfilePanel. */
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

      <SideBar />
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
      />
      <LiveChatPanel
        conversation={activeConversation}
        messages={chat.messages}
        loading={chat.loadingMessages}
        otherNowPlaying={activeOtherNowPlaying}
        onClose={chat.close}
        onSend={chat.send}
      />
      <UserPicker
        open={showUserPicker}
        onClose={() => setShowUserPicker(false)}
        onPick={(uid) => chat.openDmWith(uid)}
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

      <LocateButton />

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
      {/* RankingButton is rendered inline next to FilterTabs in the topBar;
          the SuperfansPanel above is what opens (ranking-style design fed
          by real /api/ranking data). */}

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
