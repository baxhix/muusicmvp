import styles from './PhoneStack.module.css';

/**
 * Stack de 3 mockups de iPhone cortados na borda inferior da
 * hero. Per wireframe: aparecem só os topos dos celulares,
 * sugerindo o app sem entregar a UI ainda.
 *
 * Implementação CSS-only — não precisa de asset SVG/PNG. Cada
 * "phone" é um <div> com border-radius generoso + notch
 * simulado por pseudo-elemento. Escalável e nítido em
 * qualquer DPR.
 *
 * Composição:
 *   - 2 phones laterais menores, ligeiramente rotacionados
 *     pra fora pra criar profundidade.
 *   - 1 phone central maior, frente.
 *
 * As proporções (largura, altura, raio) imitam um iPhone
 * moderno (ratio ~9:19.5 com notch dynamic-island-ish).
 */
export default function PhoneStack() {
  return (
    <div className={styles.stack} aria-hidden="true">
      <div className={`${styles.phone} ${styles.phoneLeft}`}>
        <span className={styles.notch} />
      </div>
      <div className={`${styles.phone} ${styles.phoneCenter}`}>
        <span className={styles.notch} />
      </div>
      <div className={`${styles.phone} ${styles.phoneRight}`}>
        <span className={styles.notch} />
      </div>
    </div>
  );
}
