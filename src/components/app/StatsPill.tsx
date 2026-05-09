import styles from './StatsPill.module.css';

export default function StatsPill() {
  return (
    <div className={styles.pill}>
      <div className={styles.item}>
        <span className={styles.dot} aria-hidden="true" />
        <span>Ao vivo</span>
        <span className={styles.val}>2.4M</span>
      </div>
      <div className={styles.sep} aria-hidden="true" />
      <div className={styles.item}>
        <span>Países</span>
        <span className={styles.val}>124</span>
      </div>
      <div className={styles.sep} aria-hidden="true" />
      <div className={styles.item}>
        <span>Perto de você</span>
        <span className={styles.val}>318</span>
      </div>
    </div>
  );
}
