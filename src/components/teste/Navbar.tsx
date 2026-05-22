'use client';

import { useState } from 'react';
import styles from './Navbar.module.css';

/**
 * Navbar do experimento /teste.
 *
 * Estrutura (per product feedback "deixe a palavra Fanverse do
 * header e os menus, exceto a seleção de idioma, dentro de um
 * container de 1200 aproximadamente"):
 *   - `.container` de 1200px no centro:
 *       brand "Fanverse" à esquerda + nav (Soluções / Blog /
 *       Login) à direita do container.
 *   - `.langToggle` posicionado absoluto na borda direita da
 *     viewport — FORA do container. Permanece visível mesmo
 *     em telas largas, alinhado ao mesmo padding da navbar.
 *
 * Posição: `fixed` no topo, bg transparente.
 */
export default function Navbar() {
  const [lang, setLang] = useState<'PT' | 'EN'>('PT');

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
          {/* CTA principal — pill branco com texto preto, fica
           *  no fim do nav per product feedback "totalmente
           *  arredondado, cor branca e texto preto". */}
          <a href="#meu-fanverse"  className={styles.ctaPill}>
            Meu Fanverse
          </a>
        </nav>
      </div>

      {/* Segmented control PT/EN — fora do container, colado na
       *  borda direita da viewport. Cada opção é um button
       *  próprio; o ativo recebe estilo invertido. Padrão de
       *  acessibilidade: role=group + aria-pressed nos
       *  toggles. */}
      <div className={styles.langToggle} role="group" aria-label="Idioma">
        <button
          type="button"
          className={`${styles.langOption} ${lang === 'PT' ? styles.langActive : ''}`}
          aria-pressed={lang === 'PT'}
          onClick={() => setLang('PT')}
        >
          PT
        </button>
        <button
          type="button"
          className={`${styles.langOption} ${lang === 'EN' ? styles.langActive : ''}`}
          aria-pressed={lang === 'EN'}
          onClick={() => setLang('EN')}
        >
          EN
        </button>
      </div>
    </header>
  );
}
