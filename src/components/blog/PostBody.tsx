import styles from './PostBody.module.css';

/**
 * PostBody — renderiza o HTML do post com estilos "prose"
 * otimizados pra leitura (line-length 720px, hierarquia clara
 * de headings, citações com borda lateral, imagens fluidas).
 *
 * O HTML já vem sanitizado do backend — aqui é só estilizar.
 * Mantemos as classes do CSS module em escopo via :global pra
 * que tags HTML internas (h2, p, blockquote, img, etc) peguem
 * o styling sem precisar reescrever o conteúdo.
 */
export default function PostBody({ html }: { html: string }) {
  return (
    <div
      className={styles.prose}
      // O conteúdo é sanitizado server-side antes de gravar no
      // BD (HTML semântico do editor rico) — render direto.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
