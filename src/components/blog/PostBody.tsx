import styles from './PostBody.module.css';

/**
 * PostBody — renderiza o HTML do post com estilos "prose"
 * otimizados pra leitura. CSS var `--prose-font-size` controla
 * o tamanho do corpo; outros elementos (lede, blockquote)
 * escalam proporcionais via `em`.
 *
 * Prop `fontSizePx` (opcional) injeta o var inline pra que o
 * ReadingToolbar consiga aumentar/diminuir o tamanho dinâmico.
 * Default 16px (vem do CSS module).
 */
export default function PostBody({
  html,
  fontSizePx,
}: {
  html: string;
  fontSizePx?: number;
}) {
  const inlineStyle: React.CSSProperties | undefined =
    fontSizePx
      ? ({ ['--prose-font-size' as string]: `${fontSizePx}px` } as React.CSSProperties)
      : undefined;

  return (
    <div
      className={styles.prose}
      style={inlineStyle}
      // HTML sanitizado server-side antes de gravar no BD —
      // render direto.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
