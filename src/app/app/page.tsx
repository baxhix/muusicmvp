'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback } from 'react';

import TopBar from '@/components/app/TopBar';
import FilterTabs from '@/components/app/FilterTabs';
import { LiveBadgeLayer } from '@/components/app/LiveBadge';
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

import { useChatLive } from '@/hooks/useChatLive';
import { useLocationSync } from '@/hooks/useLocationSync';
import { liveBadges, badgeSets } from '@/data/mapData';
import type { FilterTabId, LiveBadgeData } from '@/types';
import { globeStore } from '@/lib/globeStore';

import styles from './page.module.css';

const Globe = dynamic(() => import('@/components/app/Globe'), { ssr: false });

const USER_CITIES: Record<string, { center: [number, number]; zoom: number }> = {
  mariana:   { center: [-46.6333, -23.5505], zoom: 10 },
  joaopedro: { center: [11.5820,  48.1351],  zoom: 10 },
  camila:    { center: [139.6917, 35.6895],  zoom: 10 },
};

export default function AppPage() {
  const chat = useChatLive();
  const [badgePositionIdx, setBadgePositionIdx] = useState(0);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [playerSize, setPlayerSize] = useState<'mini' | 'horizontal' | 'expanded' | 'video'>('mini');
  const [showProfile, setShowProfile] = useState(false);
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

  const LOGGED_USER: ProfileUser = {
    id: 'me',
    name: 'Você',
    city: 'São Paulo',
    state: 'SP',
    streams: 14832,
    img: 'https://i.pravatar.cc/72?img=68',
    isOnline: true,
    nowPlaying: { title: 'Forro da Despedida', artist: 'Forró do Alagoano' },
  };

  const handleBadgeClick = useCallback((badge: LiveBadgeData) => {
    const city = USER_CITIES[badge.id];
    if (city) globeStore.flyTo(city.center, city.zoom);
  }, []);

  const handleTabChange = useCallback((idx: number, _tabId: FilterTabId) => {
    setBadgePositionIdx(idx);
  }, []);

  const activeConversation =
    chat.conversations.find((c) => c.id === chat.activeId) ?? null;

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
          <FilterTabs onTabChange={handleTabChange} />

          {/* Live badges */}
          <LiveBadgeLayer
            badges={liveBadges}
            positions={badgeSets[badgePositionIdx]}
            onBadgeClick={handleBadgeClick}
          />

          {/* Floating users (background ambient) */}
          <FloatingUsers />
        </div>

        <BottomNav
          onSuperfansOpen={() => setShowSuperfans(true)}
          onProfileOpen={() => setShowProfile(true)}
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

      {/* Realtime UI surfaces */}
      <NotificationBell />
      <SuperchatTrigger onClick={() => setShowSuperchat(true)} />
      <SuperchatPanel
        open={showSuperchat}
        onClose={() => setShowSuperchat(false)}
      />

      <Onboarding />
    </>
  );
}
