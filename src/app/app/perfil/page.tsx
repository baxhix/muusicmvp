'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfilePanel from '@/components/app/ProfilePanel';
import DeleteAccountModal from '@/components/app/DeleteAccountModal';
import NotificationPreferencesModal from '@/components/app/NotificationPreferencesModal';
import { useDisplayedProfile } from '@/hooks/useDisplayedProfile';
import { useAppShell } from '@/lib/app/AppShellContext';

/**
 * Perfil próprio — `/app/perfil`.
 *
 * Phase 2: was a singleton modal opened from the BottomNav avatar
 * slot. Now a dedicated route. O EditProfileModal foi promovido pro
 * shell (montado em /app/layout.tsx) — assim "Editar perfil" no
 * drawer abre o modal direto sem desviar por essa página. O botão
 * "Editar perfil" do ProfilePanel também aciona o mesmo state via
 * AppShellContext. DeleteAccountModal continua local porque é
 * exclusivo dessa rota.
 *
 * NotificationPreferencesModal também é local — só faz sentido
 * abrir a partir do "Notificações" do próprio perfil, e o state
 * (open/close) não precisa ser compartilhado com o shell.
 */
export default function PerfilPage() {
  const router = useRouter();
  const { user, isOwnProfile } = useDisplayedProfile(null);
  const { setShowEditProfile } = useAppShell();

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);

  return (
    <>
      <ProfilePanel
        user={user}
        isOwnProfile={isOwnProfile}
        onClose={() => router.push('/app')}
        onEditProfile={() => setShowEditProfile(true)}
        onOpenMessages={() => router.push('/app/superchat')}
        onOpenNotifications={() => setShowNotificationPrefs(true)}
      />

      <DeleteAccountModal
        open={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        userName="Ana Beatriz"
      />

      <NotificationPreferencesModal
        open={showNotificationPrefs}
        onClose={() => setShowNotificationPrefs(false)}
      />
    </>
  );
}
