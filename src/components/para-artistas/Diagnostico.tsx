import styles from './Diagnostico.module.css';

/**
 * Section 2 — Diagnóstico.
 *
 * Manifesto sobre o problema da indústria atual, seguido de
 * uma TABELA DE CONTRASTE Hoje vs Fanverse. A tabela é o
 * dispositivo retórico central da página — o empresário lê
 * uma linha, reconhece o problema (esquerda) e identifica a
 * solução (direita) em paralelo.
 *
 * 3 linhas pra não diluir; cada linha é uma das 3 dores que
 * o público-alvo enfrenta na operação real:
 *   1. Identidade — o fã ouve mas o artista não conhece
 *   2. Receita — fração mínima por play
 *   3. Distribuição — algoritmo decide alcance
 */

const ROWS = [
  {
    today: 'O fã ouve. Você não sabe quem é.',
    fanverse: 'O fã ouve e você sabe o nome, a cidade, o nível de engajamento.',
  },
  {
    today: 'Receita chega em frações: US$ 0,0034 por play.',
    fanverse: 'Receita direta, recorrente. Fanpoints viram capital fan-financiado.',
  },
  {
    today: 'O algoritmo decide quem te ouve.',
    fanverse: 'Você lança quando quer, pra quem você quer. Drops e pre-saves orquestrados.',
  },
];

export default function Diagnostico() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowIndex}>01</span>
            <span className={styles.eyebrowLabel}>Diagnóstico</span>
          </span>
          <h2 className={styles.title}>
            Você fez o show.<br />
            A plataforma cobrou o ingresso.<br />
            <em className={styles.titleAccent}>E ficou com o nome dos fãs.</em>
          </h2>
          <p className={styles.body}>
            Faz tempo que a indústria de música opera num modelo onde quem produz a
            obra não recebe os dados de quem consome. Os streams chegam — mas o
            relacionamento, não.
          </p>
        </header>

        <div className={styles.compareTable} role="table" aria-label="Comparação: hoje vs Fanverse">
          <div className={styles.compareHead} role="row">
            <div className={styles.compareHeadCell} role="columnheader">
              <span className={styles.compareLabel}>Hoje</span>
            </div>
            <div className={`${styles.compareHeadCell} ${styles.compareHeadCellFv}`} role="columnheader">
              <span className={styles.compareLabelFv}>Com Fanverse</span>
            </div>
          </div>

          {ROWS.map((row, i) => (
            <div className={styles.compareRow} role="row" key={i}>
              <div className={styles.compareCellToday} role="cell">
                <span className={styles.compareIndex}>0{i + 1}</span>
                <p>{row.today}</p>
              </div>
              <div className={styles.compareCellFv} role="cell">
                <span className={styles.compareIndexFv}>0{i + 1}</span>
                <p>{row.fanverse}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
