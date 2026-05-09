'use client';

import { useEffect, useState, type AnimationEvent } from 'react';
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

export default function EditProfileModal({ open, onClose }: EditProfileModalProps) {
  const [phase, setPhase] = useState<'idle' | 'in' | 'open' | 'out'>(open ? 'in' : 'idle');

  // Form state
  const [userName, setUserName] = useState('Ana Beatriz');
  const [language, setLanguage] = useState<'pt' | 'en' | 'es'>('pt');
  const [appearOnMap, setAppearOnMap] = useState(true);
  const [allowInteractions, setAllowInteractions] = useState(true);
  const [showCity, setShowCity] = useState(true);
  const [showStreams, setShowStreams] = useState(true);

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

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (phase === 'idle') return null;

  const isIn = phase === 'in';
  const isOut = phase === 'out';

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
          {/* Foto de perfil */}
          <div className={styles.photoRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ana-beatriz-avatar.png"
              alt="Foto de perfil"
              className={styles.avatar}
            />
            <div className={styles.photoActions}>
              <button type="button" className={styles.photoBtn}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Alterar foto de perfil
              </button>
              <button type="button" className={styles.photoLink}>
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
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          {/* Idioma do app */}
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

          {/* Toggles de visibilidade */}
          <div className={styles.toggleRow}>
            <div className={styles.toggleRowTop}>
              <span className={styles.toggleTitle}>Aparecer no Mapa</span>
              <Toggle
                checked={appearOnMap}
                onChange={setAppearOnMap}
                ariaLabel="Aparecer no Mapa"
              />
            </div>
            <p className={styles.toggleDesc}>
              Mostra seu perfil no mapa com localização aproximada.
            </p>
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleRowTop}>
              <span className={styles.toggleTitle}>Permitir Interações</span>
              <Toggle
                checked={allowInteractions}
                onChange={setAllowInteractions}
                ariaLabel="Permitir Interações"
              />
            </div>
            <p className={styles.toggleDesc}>
              Permite que outros usuários enviem mensagens e interajam com você.
            </p>
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleRowTop}>
              <span className={styles.toggleTitle}>Mostrar Cidade</span>
              <Toggle
                checked={showCity}
                onChange={setShowCity}
                ariaLabel="Mostrar Cidade"
              />
            </div>
            <p className={styles.toggleDesc}>
              Mostra sua cidade no perfil e na presença no mapa.
            </p>
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleRowTop}>
              <span className={styles.toggleTitle}>Total de Streams</span>
              <Toggle
                checked={showStreams}
                onChange={setShowStreams}
                ariaLabel="Total de Streams"
              />
            </div>
            <p className={styles.toggleDesc}>
              Mostra seu total de streams no perfil.
            </p>
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onClose}
          >
            Salvar alterações
          </button>
        </footer>
      </aside>
    </>
  );
}
