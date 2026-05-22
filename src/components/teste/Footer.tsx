import styles from './Footer.module.css';

/**
 * Footer do /teste.
 *
 * Estrutura per wireframe:
 *   - 3 colunas de links (Company / Superfãs / Para Artistas)
 *     na esquerda, alinhadas ao topo.
 *   - Endereço de email "hello@fanverse.com.br" enorme à
 *     direita — vira o ponto de destaque do footer (CTA
 *     visual implícito).
 *   - Linha de policies (Privacidade + Termos) centralizada
 *     embaixo.
 *   - Wordmark gigante FANVERSE no rodapé, ultra-discreto
 *     (rgba branco ~0.04) — quase invisível, dá só uma
 *     sensação de marca preenchendo o espaço sem competir
 *     com o conteúdo.
 *
 * Os usuários flutuantes da AvatarConstellation (que aparecem
 * por cima quando o footer entra no viewport) são gerenciados
 * em paralelo — não tem nada relacionado a eles aqui.
 */
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* Top row: colunas de links + email destaque */}
        <div className={styles.topRow}>
          <div className={styles.linksGrid}>
            <div className={styles.col}>
              <h4 className={styles.colTitle}>Company</h4>
              <a href="#sobre"    className={styles.link}>Sobre</a>
              <a href="/blog"     className={styles.link}>Blog</a>
              <a href="#imprensa" className={styles.link}>Imprensa</a>
            </div>
            <div className={styles.col}>
              <h4 className={styles.colTitle}>Superfãs</h4>
              <a href="#sf-1"   className={styles.link}>Manifesto</a>
              <a href="#sf-2"   className={styles.link}>Manifesto</a>
              <a href="#sf-3"   className={styles.link}>Manifesto</a>
              <a href="#sf-time" className={styles.link}>Time</a>
            </div>
            <div className={styles.col}>
              <h4 className={styles.colTitle}>Para Artistas</h4>
              <a href="#pa-1"   className={styles.link}>Manifesto</a>
              <a href="#pa-2"   className={styles.link}>Manifesto</a>
              <a href="#pa-3"   className={styles.link}>Manifesto</a>
              <a href="#pa-time" className={styles.link}>Time</a>
            </div>
          </div>

          <a
            href="mailto:hello@fanverse.com.br"
            className={styles.email}
            aria-label="Enviar email para hello@fanverse.com.br"
          >
            hello@fanverse.com.br
          </a>
        </div>

        {/* Policy row centralizada */}
        <div className={styles.policyRow}>
          <a href="#privacidade" className={styles.policyLink}>
            Políticas de Privacidade
          </a>
          <a href="#termos" className={styles.policyLink}>
            Termos de uso
          </a>
        </div>
      </div>

      {/* Wordmark gigante atrás de tudo. aria-hidden — é só
       *  decoração visual. */}
      <div className={styles.bgWordmark} aria-hidden="true">
        FANVERSE
      </div>
    </footer>
  );
}
