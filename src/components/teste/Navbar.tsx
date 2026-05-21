'use client';

import { useState } from 'react';
import styles from './Navbar.module.css';

/**
 * Navbar do experimento /teste.
 *
 * Estrutura per wireframe:
 *   - Brand "Fanverse" à esquerda (não usa o logo SVG aqui —
 *     o experimento brinca com puro texto pra entoar leveza).
 *   - Cluster central: Soluções / Blog / Login.
 *   - Toggle de idioma "PT" à direita (clica e abre dropdown
 *     futuro com EN/ES). Por enquanto é só visual.
 *
 * Posição: `fixed` no topo com bg transparente. Quando scroll
 * passar de ~80px o navbar ganha bg semi-opaco (frosted) pra
 * não competir com o conteúdo abaixo — implementado via
 * IntersectionObserver/scroll listener mais à frente conforme
 * mais seções forem montadas.
 */
export default function Navbar() {
  const [lang, setLang] = useState<'PT' | 'EN' | 'ES'>('PT');

  return (
    <header className={styles.navbar}>
      <a href="/teste" className={styles.brand} aria-label="Fanverse — início">
        Fanverse
      </a>

      <div className={styles.rightCluster}>
        <nav className={styles.nav} aria-label="Principal">
          <a href="#solucoes" className={styles.navLink}>
            Soluções
          </a>
          <a href="#blog" className={styles.navLink}>
            Blog
          </a>
          <a href="#login" className={styles.navLink}>
            Login
          </a>
        </nav>

        <button
          type="button"
          className={styles.langToggle}
          onClick={() => {
            // Stub: ciclar pelas opções. Substituir por dropdown
            // real quando i18n estiver wired.
            setLang((prev) =>
              prev === 'PT' ? 'EN' : prev === 'EN' ? 'ES' : 'PT',
            );
          }}
          aria-label={`Idioma: ${lang}. Clique pra trocar.`}
        >
          {lang}
        </button>
      </div>
    </header>
  );
}
