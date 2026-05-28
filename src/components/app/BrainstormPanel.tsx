'use client';

import { useEffect, useState } from 'react';
import {
  FLAG_DESCRIPTORS,
  isBrainstormOwner,
  useBrainstormFlags,
} from '@/lib/brainstormFlags';
import { useAuth } from '@/lib/auth/AuthContext';
import styles from './BrainstormPanel.module.css';

/**
 * "Brainstorm" lightbulb trigger + toggle panel.
 *
 * Lives mid-left rail of /app home and ONLY mounts when the
 * authenticated user's email is in `BRAINSTORM_ALLOWED_EMAILS`
 * — every other viewer sees nothing. The lightbulb opens a small
 * floating sheet listing every registered experimental feature;
 * each row carries a switch that flips a flag in localStorage
 * via `lib/brainstormFlags`.
 *
 * The whole surface unmounts on non-home routes anyway (mounted
 * inside `/app/page.tsx`), so the gate fires before any flag
 * read or render work happens.
 */
export default function BrainstormPanel() {
  const [open, setOpen] = useState(false);
  const { flags, setFlag } = useBrainstormFlags();
  const { user } = useAuth();

  // Gate: only allowlisted brainstorm viewers see this surface.
  // Email comparison is normalized (lowercase + trim) inside
  // `isBrainstormOwner` so capitalization variants don't leak.
  const isOwner = isBrainstormOwner(user?.email);

  // Dismiss on Escape so the sheet feels like the other floating
  // surfaces (PlaylistModal, kebab menus). Click-outside closes
  // via the scrim.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Active count — when one or more experimental features are
  // enabled, the lightbulb gets a tiny glow ring + dot so the
  // team can see at a glance that something experimental is
  // mounted on the surface.
  const activeCount = Object.values(flags).filter(Boolean).length;

  // Email gate — only the brainstorm owner sees the lightbulb
  // and the toggle panel. Everyone else gets nothing.
  if (!isOwner) return null;

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${activeCount > 0 ? styles.triggerActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={
          open
            ? 'Fechar painel de brainstorm'
            : 'Abrir painel de brainstorm'
        }
        aria-expanded={open}
        title="Brainstorm — features em teste"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {/* Lightbulb with filament — standard "ideas" glyph.
           *  Outline stroke + a small filled bottom socket so the
           *  shape reads even at 18px on the trigger. */}
          <path
            d="M9 18h6M10 22h4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M12 3a6 6 0 0 0-3.5 10.86c.7.51 1.2 1.27 1.4 2.14H14.1c.2-.87.7-1.63 1.4-2.14A6 6 0 0 0 12 3z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M10 12c0-1.5 1-2 2-2s2 .5 2 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {activeCount > 0 && (
          <span className={styles.triggerDot} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          className={styles.scrim}
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className={styles.panel}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="false"
            aria-label="Brainstorm — features experimentais"
          >
            {/* Header trimmed per product feedback — only the
             *  centered "Features em teste" title + the close X
             *  remain. Kicker ("Brainstorm") and the subtitle
             *  helper text were removed. */}
            <header className={styles.header}>
              <h2 className={styles.title}>Features em teste</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            <ul className={styles.list}>
              {FLAG_DESCRIPTORS.map((descriptor) => {
                const value = !!flags[descriptor.key];
                return (
                  <li key={descriptor.key} className={styles.item}>
                    <div className={styles.itemText}>
                      <span className={styles.itemTitle}>{descriptor.title}</span>
                      <span className={styles.itemDescription}>
                        {descriptor.description}
                      </span>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setFlag(descriptor.key, e.target.checked)}
                        aria-label={`${descriptor.title} — ${value ? 'ligado' : 'desligado'}`}
                      />
                      <span className={styles.switchTrack} aria-hidden="true">
                        <span className={styles.switchThumb} />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {/* (Footnote disclaimer removed per product feedback —
             *  the panel is now just the title + toggle list.) */}
          </div>
        </div>
      )}
    </>
  );
}
