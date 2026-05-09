export interface ChatMessage {
  dir: 'in' | 'out' | 'typing';
  text?: string;
  song?: { title: string; artist: string; img: string };
  time?: string;
}

export interface ChatUser {
  id: string;
  name: string;
  initials: string;
  bg: string;
  online: boolean;
  status?: 'online' | 'away' | 'offline';
  img?: string;
  statusText: string;
  unreadCount?: number;
  currentSong?: string;
  messages: ChatMessage[];
}

export interface LiveBadgeData {
  id: string;
  name: string;
  song: string;
  initials: string;
  bg: string;
  img?: string;
  audioColor?: string;
}

export type FilterTabId = 'all' | 'nearby' | 'taste' | 'friends';

export interface BadgePositionSet {
  left: string;
  top: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: 'map' | 'explore' | 'share' | 'match' | 'profile';
  isCenter?: boolean;
}

export interface GlobeUser {
  name: string;
  city: string;
  song: string;
  artist: string;
  initials: string;
  bg: string;
  position: {
    left?: string;
    right?: string;
    top: string;
  };
  alignRight?: boolean;
}

export interface FeatureRowData {
  num: string;
  title: string;
  titleEm: string;
  desc: string;
  mediaType: 'pulse' | 'bars' | 'network' | 'privacy' | 'performance';
}
