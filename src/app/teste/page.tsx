'use client';

import styles from './page.module.css';

/**
 * `/teste` — sandbox de landing.
 *
 * Rota temporária pra experimentar layouts/wireframes novos sem
 * impactar a landing pública (`/`). Aguardando wireframe do
 * produto pra começar a construir o conteúdo.
 *
 * Convenções pro experimento:
 *   - Components específicos vão pra `src/components/teste/*`
 *     (NÃO em `landing/` — quero o experimento isolado da
 *     produção pra ficar fácil de promover ou descartar).
 *   - CSS deste page.tsx fica em `./page.module.css`.
 *   - Quando o experimento for promovido, basta `mv` o
 *     conteúdo pra `/` e apagar essa rota.
 *
 * O layout pai já marca `robots: noindex` — crawlers ignoram.
 */
export default function TestePage() {
  return (
    <div className={styles.page}>
      <main className={styles.canvas}>
        {/* Conteúdo do experimento entra aqui assim que o
         *  wireframe chegar. Mantenha a estrutura semântica:
         *  <header> / <section> / <footer> ajuda o LLM-crawl
         *  (mesmo sem indexar, o produto pode usar essas
         *  zonas pra A/B testing futuro). */}
        <div className={styles.placeholder}>
          <span className={styles.badge}>/teste · sandbox</span>
          <p className={styles.hint}>
            Aguardando wireframe pra iterar.
          </p>
        </div>
      </main>
    </div>
  );
}
