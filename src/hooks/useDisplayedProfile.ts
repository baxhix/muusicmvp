'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { ProfileUser } from '@/components/app/ProfilePanel';

/**
 * Resolves a `ProfileUser` shape ready for <ProfilePanel> from
 * either:
 *
 *   - `null` / undefined → the logged-in user (own profile),
 *   - a userId string    → that user's public profile.
 *
 * The hook always fetches via `/api/users/:id/profile` so the
 * shape (fanpoints, streams, isOnline, nowPlaying) is consistent
 * between own + other; before the fetch resolves we fall back to
 * the auth record so the first paint isn't empty.
 *
 * Extracted from the old in-page logic so both `/app/perfil`
 * (own) and `/app/u/[id]` (other) consume the same builder.
 */
export function useDisplayedProfile(targetUserId: string | null): {
  user: ProfileUser;
  isOwnProfile: boolean;
} {
  const { user: authUser } = useAuth();
  const ownId = authUser?.id ?? null;
  const effectiveId = targetUserId ?? ownId;
  const { profile: viewingProfile } = useUserProfile(effectiveId);

  const isOwnProfile =
    targetUserId === null || targetUserId === ownId;

  const user: ProfileUser = viewingProfile
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

  return { user, isOwnProfile };
}
