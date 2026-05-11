'use client';

import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ChangeEvent,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { api, ApiError } from '@/lib/api/client';
import styles from './EditProfileModal.module.css';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: { checked: boolean; onChange: (v: boolean) => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

const PLACEHOLDER_AVATAR = (id: string) => `https://i.pravatar.cc/96?u=${id}`;

export default function EditProfileModal({ open, onClose }: EditProfileModalProps) {
  const { user, refresh } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'in' | 'open' | 'out'>(open ? 'in' : 'idle');

  // Form state (initialised when the modal opens from current user values).
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<'pt' | 'en' | 'es'>('pt');
  const [appearOnMap, setAppearOnMap] = useState(true);
  const [allowInteractions, setAllowInteractions] = useState(true);
  const [showCity, setShowCity] = useState(true);
  const [showStreams, setShowStreams] = useState(true);

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

  const displayAvatar =
    avatarUrl ?? (user ? PLACEHOLDER_AVATAR(user.id) : '/ana-castela-box.jpg');

  return (
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

          {/* Toggles de visibilidade (mock até backend de preferências) */}
          <div className={styles.toggleRow}>
            <div className={styles.toggleRowTop}>
              <span className={styles.toggleTitle}>Aparecer no Mapa</span>
              <Toggle checked={appearOnMap} onChange={setAppearOnMap} ariaLabel="Aparecer no Mapa" />
            </div>
            <p className={styles.toggleDesc}>Mostra seu perfil no mapa com localização aproximada.</p>
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleRowTop}>
              <span className={styles.toggleTitle}>Permitir Interações</span>
              <Toggle checked={allowInteractions} onChange={setAllowInteractions} ariaLabel="Permitir Interações" />
            </div>
            <p className={styles.toggleDesc}>Permite que outros usuários enviem mensagens e interajam com você.</p>
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleRowTop}>
              <span className={styles.toggleTitle}>Mostrar Cidade</span>
              <Toggle checked={showCity} onChange={setShowCity} ariaLabel="Mostrar Cidade" />
            </div>
            <p className={styles.toggleDesc}>Mostra sua cidade no perfil e na presença no mapa.</p>
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleRowTop}>
              <span className={styles.toggleTitle}>Total de Streams</span>
              <Toggle checked={showStreams} onChange={setShowStreams} ariaLabel="Total de Streams" />
            </div>
            <p className={styles.toggleDesc}>Mostra seu total de streams no perfil.</p>
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
}
