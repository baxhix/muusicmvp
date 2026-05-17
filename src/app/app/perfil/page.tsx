'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfilePanel from '@/components/app/ProfilePanel';
import EditProfileModal from '@/components/app/EditProfileModal';
import DeleteAccountModal from '@/components/app/DeleteAccountModal';
import { useDisplayedProfile } from '@/hooks/useDisplayedProfile';

/**
 * Perfil próprio — `/app/perfil`.
 *
 * Phase 2: was a singleton modal opened from the BottomNav avatar
 * slot. Now a dedicated route. Owns the local sub-modals it
 * needs (edit + delete account) so the modals don't have to live
 * in the persistent shell.
 */
export default function PerfilPage() {
  const router = useRouter();
  const { user, isOwnProfile } = useDisplayedProfile(null);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  return (
    <>
      <ProfilePanel
        user={user}
        isOwnProfile={isOwnProfile}
        onClose={() => router.push('/app')}
        onEditProfile={() => setShowEditProfile(true)}
        onOpenMessages={() => router.push('/app/superchat')}
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
    </>
  );
}
