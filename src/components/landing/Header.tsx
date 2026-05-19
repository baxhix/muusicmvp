'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './Header.module.css';

const LANGUAGES = [
  { code: 'PT', label: 'Português', lang: 'pt' },
  { code: 'EN', label: 'English',   lang: 'en' },
  { code: 'ES', label: 'Español',   lang: 'es' },
];

/** Mirror of the flag in `src/app/page.tsx`. When `true` the
 *  header collapses to just the brand/logo — the nav links,
 *  "Baixar o App" CTA, and the language picker are gated off.
 *  Flip both flags together to restore the full header. */
const MINIMAL_LANDING = true;

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [activeLang, setActiveLang] = useState('PT');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles['header--scrolled'] : ''}`}>
      <div className={styles.inner}>
        {/* Real Fanverse SVG brand mark replaces the previous
            CSS circle-and-dot placeholder per product feedback
            "Coloque o logo do Fanverse na home, ainda está o
            padrão". Same asset that the auth email-entry step
            and the in-app mobile chrome use, so the brand
            identity reads consistently across landing → auth →
            home. */}
        <Link href="/" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fanverse-logo.svg"
            alt=""
            className={styles.brandMark}
            aria-hidden="true"
          />
          <span>Fanverse</span>
        </Link>

        {/* Nav links + "Baixar o App" CTA are gated under
            MINIMAL_LANDING so the header reads as just the
            logo in the simplified landing. */}
        {!MINIMAL_LANDING && (
          <nav className={styles.nav}>
            <div className={styles.navLinks}>
              <a href="#features">Nosso Universo</a>
              <a href="#artists">Para Artistas</a>
              <a href="#blog">Blog</a>
            </div>
            <Link href="/app" className={styles.btnPrimary}>
              Baixar o App
            </Link>
          </nav>
        )}
      </div>

      {/* Language Picker — also gated under MINIMAL_LANDING. */}
      {!MINIMAL_LANDING && (
        <div
          ref={pickerRef}
          className={`${styles.langPicker} ${langOpen ? styles.langPickerOpen : ''}`}
        >
          <button
            className={styles.langTrigger}
            onClick={() => setLangOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
          >
            <span>{activeLang}</span>
            <svg className={styles.langChevron} viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <ul className={styles.langDropdown} role="listbox">
            {LANGUAGES.map((l) => (
              <li
                key={l.lang}
                role="option"
                aria-selected={activeLang === l.code}
                className={`${styles.langOption} ${activeLang === l.code ? styles.langOptionActive : ''}`}
                onClick={() => { setActiveLang(l.code); setLangOpen(false); }}
              >
                <span className={styles.langOptLabel}>{l.label}</span>
                <span className={styles.langOptCode}>{l.code}</span>
                <svg className={styles.langCheck} viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
