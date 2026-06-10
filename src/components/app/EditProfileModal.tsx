'use client';

import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ChangeEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { api, ApiError } from '@/lib/api/client';
import { track } from '@/lib/analytics';
import MotionSwitch from './MotionSwitch';
import styles from './EditProfileModal.module.css';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

/* Toggle local removido — substituído pelo MotionSwitch
 * compartilhado (animação spring no thumb via motion). */

/** Generic silhouette used while a user hasn't uploaded their
 *  own avatar yet. Previous code seeded a deterministic
 *  pravatar.cc photo here, which meant brand-new accounts saw a
 *  RANDOM stranger's face on the Edit Profile modal until they
 *  uploaded their own — per product feedback "Quando um novo
 *  usuário for cadastrado, deixe sem foto alguma no avatar, use
 *  o ícone padrão. Não utilize outras imagens de outros usuários
 *  mocados". The silhouette SVG ships in /public alongside the
 *  rest of the brand assets. */
const PLACEHOLDER_AVATAR = '/avatar-placeholder.svg';

export default function EditProfileModal({ open, onClose }: EditProfileModalProps) {
  const { user, refresh } = useAuth();
  // Menor de idade nunca compartilha localização (LGPD) — o toggle
  // fica desabilitado/off.
  const isMinor = Boolean(user?.isMinor);
  const [phase, setPhase] = useState<'idle' | 'in' | 'open' | 'out'>(open ? 'in' : 'idle');

  // Form state (initialised when the modal opens from current user values).
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<'pt' | 'en' | 'es'>('pt');
  /* "Aparecer no Mapa" agora é o consentimento LGPD REAL
   * (users.location_consent) — espelha user.locationConsent e
   * persiste no PATCH /api/me/location-consent (não é mais mock).
   * Desligar zera a localização e tira o usuário do mapa pros outros. */
  const [appearOnMap, setAppearOnMap] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  // Loading flags & feedback
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync from auth state only on the closed→open transition. After that,
  // local state owns the form values so optimistic updates from uploads
  // don't get clobbered when refresh() lands a moment later.
  const prevOpenRef = useRef(open);
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    if (justOpened && user) {
      setName(user.name ?? '');
      setAvatarUrl(user.avatarUrl ?? null);
      setAppearOnMap(Boolean(user.locationConsent));
      setError(null);
    }
    prevOpenRef.current = open;
  }, [open, user]);

  // Animation phase machine
  useEffect(() => {
    if (open) {
      setPhase((p) => (p === 'idle' || p === 'out' ? 'in' : p));
    } else {
      setPhase((p) => (p === 'idle' ? 'idle' : 'out'));
    }
  }, [open]);

  const handleAnimationEnd = (e: AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (phase === 'in' && e.animationName.includes('edit-rise')) setPhase('open');
    if (phase === 'out' && e.animationName.includes('edit-fall')) setPhase('idle');
  };

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (phase === 'idle') return null;
  const isIn = phase === 'in';
  const isOut = phase === 'out';

  const onPickAvatar = () => fileInputRef.current?.click();

  const onAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    // Quick client-side guards mirror the server limits.
    if (file.size > 2 * 1024 * 1024) {
      setError('Imagem muito grande (máx 2 MB).');
      return;
    }
    if (!/^image\/(jpe?g|png|webp|gif)$/i.test(file.type)) {
      setError('Formato não suportado. Use JPG, PNG, WebP ou GIF.');
      return;
    }

    setError(null);
    setAvatarBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/me/avatar', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = (data as { error?: string }).error ?? 'upload_failed';
        setError(
          code === 'too_large'        ? 'Imagem muito grande (máx 2 MB).' :
          code === 'unsupported_type' ? 'Formato não suportado.' :
                                        'Falha no upload. Tenta de novo.',
        );
        return;
      }
      const data = (await res.json()) as { avatarUrl: string };
      setAvatarUrl(data.avatarUrl);
      await refresh();
    } catch (err) {
      console.error('avatar upload failed:', err);
      setError('Falha no upload. Verifica sua conexão.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const onRemoveAvatar = async () => {
    if (!avatarUrl && !user?.avatarUrl) return;
    setError(null);
    setAvatarBusy(true);
    try {
      await api.delete('/api/me/avatar');
      setAvatarUrl(null);
      await refresh();
    } catch (err) {
      console.error('avatar remove failed:', err);
      setError('Não consegui remover a foto.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const onSave = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('O nome não pode ficar em branco.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      // Only PATCH the name (avatar is saved immediately on upload).
      if (trimmed !== (user.name ?? '')) {
        await api.patch('/api/me/profile', { name: trimmed });
        await refresh();
      }
      onClose();
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'unknown';
      console.error('save profile failed:', err);
      setError(`Não consegui salvar agora (${code}).`);
    } finally {
      setSaving(false);
    }
  };

  /* Toggle "Aparecer no Mapa" = consentimento LGPD real. Persiste na
   * hora (PATCH /api/me/location-consent) + refresh — assim some pros
   * outros usuários (listOnlineUsers filtra por location_consent e a
   * revogação zera lat/lng/city) e o estado sobrevive ao reload (vem
   * de user.locationConsent no /api/auth/me). Optimistic + rollback. */
  const handleAppearOnMap = async (next: boolean) => {
    if (consentBusy || isMinor) return;
    setAppearOnMap(next);
    setConsentBusy(true);
    try {
      await api.patch('/api/me/location-consent', { consent: next });
      if (next) track('location_consent_granted', { surface: 'settings' });
      else track('location_consent_revoked', {});
      await refresh();
    } catch (err) {
      setAppearOnMap(!next); // rollback
      console.error('location consent toggle failed:', err);
      setError('Não consegui atualizar a visibilidade no mapa. Tenta de novo.');
    } finally {
      setConsentBusy(false);
    }
  };

  const displayAvatar = avatarUrl ?? PLACEHOLDER_AVATAR;

  // The whole `/app/*` shell lives inside `.shell` (position:fixed,
  // z-index:55) which traps every descendant in its stacking context.
  // Without a portal, the modal's z:135 collapses to z:55 from the
  // document's perspective — and floating siblings outside the shell
  // (LiveChatStack .dock z:200, BottomNav, etc.) paint over it, so
  // clicking "Editar perfil" looked like nothing happened. Portaling
  // to <body> escapes the trap so the modal stacks above everything
  // else as intended.
  const content = (
    <>
      <div
        className={`${styles.backdrop} ${isOut ? styles.backdropOut : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`${styles.panel} ${isIn ? styles.panelEntering : ''} ${isOut ? styles.panelClosing : ''}`}
        onAnimationEnd={handleAnimationEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Edição de Perfil"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Edição de Perfil</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {/* Hidden file input — controlled by the photo buttons below. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onAvatarChange}
            style={{ display: 'none' }}
          />

          {/* Foto de perfil */}
          <div className={styles.photoRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              // key forces React to unmount/remount the img when the URL
              // changes, sidestepping any DOM-level caching of the previous
              // src that occasionally keeps the old image visible.
              key={displayAvatar}
              src={displayAvatar}
              alt="Foto de perfil"
              className={styles.avatar}
              style={avatarBusy ? { opacity: 0.5 } : undefined}
            />
            <div className={styles.photoActions}>
              <button
                type="button"
                className={styles.photoBtn}
                onClick={onPickAvatar}
                disabled={avatarBusy}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                {avatarBusy ? 'Enviando…' : 'Alterar foto de perfil'}
              </button>
              <button
                type="button"
                className={styles.photoLink}
                onClick={onRemoveAvatar}
                disabled={avatarBusy || !avatarUrl}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                </svg>
                Remover foto
              </button>
            </div>
          </div>

          {/* Nome de usuário */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Nome de usuário</label>
            <input
              type="text"
              className={styles.fieldInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Como podemos te chamar?"
            />
          </div>

          {error && <div className={styles.errorBox}>{error}</div>}

          {/* Idioma do app (mock até backend de preferências) */}
          <h3 className={styles.sectionTitle}>Idioma do app</h3>
          <p className={styles.sectionDesc}>
            Escolha o idioma que você prefere usar no aplicativo.
          </p>
          <div className={styles.langPills}>
            <button
              type="button"
              className={`${styles.langPill} ${language === 'pt' ? styles.langPillActive : ''}`}
              onClick={() => setLanguage('pt')}
            >
              Português (Brasil)
            </button>
            <button
              type="button"
              className={`${styles.langPill} ${language === 'en' ? styles.langPillActive : ''}`}
              onClick={() => setLanguage('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`${styles.langPill} ${language === 'es' ? styles.langPillActive : ''}`}
              onClick={() => setLanguage('es')}
            >
              Español
            </button>
          </div>

          {/* "Aparecer no Mapa" = consentimento de localização LGPD
              (real, persistido). Único toggle de visibilidade — os mocks
              "Permitir Interações" e "Total de Streams" foram removidos
              por não terem backend de preferências. */}
          <div className={styles.toggleRow}>
            <div className={styles.toggleRowTop}>
              <span className={styles.toggleTitle}>Aparecer no Mapa</span>
              <MotionSwitch
                checked={appearOnMap}
                onCheckedChange={handleAppearOnMap}
                disabled={isMinor || consentBusy}
                ariaLabel="Aparecer no Mapa"
              />
            </div>
            <p className={styles.toggleDesc}>
              {isMinor
                ? 'Indisponível para menores de 18 anos.'
                : 'Mostra você no mapa pros outros fãs com cidade e localização aproximada (nunca exata). Desligar te esconde do mapa na hora; religar te mostra de novo.'}
            </p>
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </footer>
      </aside>
    </>
  );

  // Guard for SSR — even though this file is 'use client', the
  // first render runs on the server when a parent renders it with
  // open=false. In that case `phase === 'idle'` already short-
  // circuits above, so this branch only fires on the client.
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
