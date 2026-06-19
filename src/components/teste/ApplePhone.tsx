import styles from './ApplePhone.module.css';

/**
 * ApplePhone — mockup de celular com o brilho animado estilo "Apple
 * Intelligence" (gradiente cônico girando nas bordas da tela + bloom
 * externo respirando). CSS puro, sem WebGL. Decorativo (aria-hidden).
 *
 * Substitui o PNG dos 3 smartphones na Hero da /teste.
 */
export default function ApplePhone() {
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.bloom} />
      <div className={styles.phone}>
        <div className={styles.screen}>
          <span className={styles.island} />
        </div>
      </div>
    </div>
  );
}
