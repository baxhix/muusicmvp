'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import TopBar from '@/components/app/TopBar';
import FilterTabs from '@/components/app/FilterTabs';
import LiveChatStack from '@/components/app/LiveChatStack';
import LiveChatPanel from '@/components/app/LiveChatPanel';
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

import { useChatLive } from '@/hooks/useChatLive';
import { useLocationSync } from '@/hooks/useLocationSync';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTracksCatalog } from '@/hooks/useTracksCatalog';
import { globeStore } from '@/lib/globeStore';

import styles from './page.module.css';

const Globe = dynamic(() => import('@/components/app/Globe'), { ssr: false });

export default function AppPage() {
  const { user: authUser } = useAuth();
  const chat = useChatLive();
  const { users: liveUsers, totalRegistered } = useLiveUsers();
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [playerSize, setPlayerSize] = useState<'mini' | 'horizontal' | 'expanded' | 'video'>('mini');
  const [showProfile, setShowProfile] = useState(false);
  // Single state for "ranking-style" panel — both the Ranking button in
  // the top bar and the crown icon in the bottom nav route here. Uses the
  // SuperfansPanel UI fed with real /api/ranking data.
  const [showSuperfans, setShowSuperfans] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showSuperchat, setShowSuperchat] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
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

  // Build the ProfileUser shape from the live auth record. Falls back to a
  // pravatar placeholder when no avatar has been uploaded yet so the UI
  // never shows a broken image.
  const LOGGED_USER: ProfileUser = {
    id: authUser?.id ?? 'me',
    name: authUser?.name ?? authUser?.email?.split('@')[0] ?? 'Você',
    city: authUser?.city ?? '—',
    state: authUser?.countryCode ?? '',
    streams: 0,
    img: authUser?.avatarUrl ?? `https://i.pravatar.cc/72?u=${authUser?.id ?? 'me'}`,
    isOnline: true,
    nowPlaying: undefined,
  };

  const activeConversation =
    chat.conversations.find((c) => c.id === chat.activeId) ?? null;

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
        onOpen={chat.open}
        onAddClick={() => setShowUserPicker(true)}
      />
      <LiveChatPanel
        conversation={activeConversation}
        messages={chat.messages}
        loading={chat.loadingMessages}
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
            user={LOGGED_USER}
            isOwnProfile
            onClose={() => setShowProfile(false)}
            onEditProfile={() => setShowEditProfile(true)}
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

      <Onboarding />
    </>
  );
}
