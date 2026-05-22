'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Navbar.module.css';

type Lang = 'PT' | 'EN';

const LANG_LABELS: Record<Lang, { native: string; sub: string }> = {
  PT: { native: 'Português', sub: 'Brasil' },
  EN: { native: 'English',   sub: 'United States' },
};

/**
 * Navbar do experimento /teste.
 *
 * Estrutura:
 *   - `.container` (1200px) centralizado: brand SVG à esquerda
 *     + nav (O App / Para Artistas / Meu Fanverse) à direita.
 *   - `.menuTrigger` (botão hamburger de 3 traços) FORA do
 *     container, na borda direita da viewport — substitui o
 *     antigo segmented PT/EN per product feedback "substitua os
 *     botões de idiomas por três traços para abrir um super
 *     submenu. Os idiomas ficarão dentro dele".
 *   - `.menuPanel` aparece abaixo do trigger quando aberto;
 *     contém a heading "Idioma" + as opções de idioma como
 *     itens. Fecha em outside click, Escape, ou seleção.
 *
 * Posição: `fixed` no topo, frosted glass + backdrop blur.
 */
export default function Navbar() {
  const [lang, setLang] = useState<Lang>('PT');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* Fecha o menu em outside click / Escape. Listeners só
   * existem enquanto o menu está aberto — evita custo de
   * keydown global no resto da sessão. */
  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  function pickLang(next: Lang) {
    setLang(next);
    setMenuOpen(false);
  }

  return (
    <header className={styles.navbar}>
      {/* Container 1200px com brand + nav nas pontas. */}
      <div className={styles.container}>
        <a href="/teste" className={styles.brand} aria-label="Fanverse — início">
          {/* Logo SVG mono-branco. Tamanho controlado via CSS
           *  (height: 20px) pra ficar proporcional à navbar
           *  (padding vertical 18px). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/teste/fanverse-logo.svg"
            alt="Fanverse"
            className={styles.brandLogo}
          />
        </a>

        <nav className={styles.nav} aria-label="Principal">
          <a href="#o-app"         className={styles.navLink}>O App</a>
          <a href="#para-artistas" className={styles.navLink}>Para Artistas</a>
          {/* CTA principal → /auth (fluxo de autenticação
           *  unificado email-first). */}
          <a href="/auth"  className={styles.ctaPill}>
            Meu Fanverse
          </a>
        </nav>
      </div>

      {/* Menu trigger (3 traços) + super submenu — fora do
       *  container, colado na borda direita da viewport. O
       *  trigger é um button regular; o panel mora dentro do
       *  mesmo wrapper pra que o outside-click handler
       *  reconheça ambos como "interior". */}
      <div className={styles.menuRoot} ref={menuRef}>
        <button
          type="button"
          className={`${styles.menuTrigger} ${menuOpen ? styles.menuTriggerOpen : ''}`}
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>

        <div
          className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}
          role="menu"
          aria-hidden={!menuOpen}
        >
          <div className={styles.menuSectionLabel}>Idioma</div>
          {(Object.keys(LANG_LABELS) as Lang[]).map((code) => {
            const isActive = lang === code;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ''}`}
                onClick={() => pickLang(code)}
              >
                <span className={styles.menuItemCode}>{code}</span>
                <span className={styles.menuItemLabel}>
                  <span className={styles.menuItemNative}>{LANG_LABELS[code].native}</span>
                  <span className={styles.menuItemSub}>{LANG_LABELS[code].sub}</span>
                </span>
                {isActive && (
                  <span className={styles.menuItemCheck} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
