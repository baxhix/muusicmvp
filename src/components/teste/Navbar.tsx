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
  const [lang, setLang] = useState<'PT' | 'EN' | 'ES'>('PT');

  return (
    <header className={styles.navbar}>
      {/* Container 1200px com brand + nav nas pontas. */}
      <div className={styles.container}>
        <a href="/teste" className={styles.brand} aria-label="Fanverse — início">
          Fanverse
        </a>

        <nav className={styles.nav} aria-label="Principal">
          <a href="#solucoes" className={styles.navLink}>Soluções</a>
          <a href="#blog"     className={styles.navLink}>Blog</a>
          <a href="#login"    className={styles.navLink}>Login</a>
        </nav>
      </div>

      {/* Lang toggle FORA do container — fica colado na borda
       *  direita da viewport mesmo em telas muito largas. */}
      <button
        type="button"
        className={styles.langToggle}
        onClick={() => {
          setLang((prev) =>
            prev === 'PT' ? 'EN' : prev === 'EN' ? 'ES' : 'PT',
          );
        }}
        aria-label={`Idioma: ${lang}. Clique pra trocar.`}
      >
        {lang}
      </button>
    </header>
  );
}
