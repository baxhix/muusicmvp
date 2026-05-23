import styles from './Inversao.module.css';

/**
 * Section 3 — A Inversão.
 *
 * 3 pilares da proposta apresentados como cards numerados
 * grandes. Cada card tem:
 *   - número gigante gradient (peso visual);
 *   - título Borscha bold;
 *   - corpo explicativo curto;
 *   - "rewrite" — antes/depois resumido em 1 linha.
 *
 * O dispositivo "rewrite" é o que ancora cada pilar numa
 * promessa concreta — converte abstração ("relação direta")
 * em frase reconhecível ("não passa por algoritmo"). */

const PILLARS = [
  {
    n: '01',
    title: 'Relação direta',
    body:
      'Sem intermediário entre artista e fã. O cadastro, a mensagem, o lançamento — tudo passa pela infraestrutura, não pelo timeline de uma plataforma de terceiros.',
    rewrite: 'Não passa por algoritmo.',
  },
  {
    n: '02',
    title: 'Dados próprios',
    body:
      'Você opera com o dado bruto: quem é o fã, onde mora, há quanto tempo escuta, como engaja. Exportável, integrável, auditável. Compliance LGPD by design.',
    rewrite: 'O CRM passa a ser seu.',
  },
  {
    n: '03',
    title: 'Receita recorrente',
    body:
      'Fanpoints, drops com fila, conteúdo premium, pre-saves monetizados. A receita deixa de depender de um único pico de lançamento — vira compounding mensal.',
    rewrite: 'Não depende de virar viral.',
  },
];

export default function Inversao() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowIndex}>02</span>
            <span className={styles.eyebrowLabel}>A proposta</span>
          </span>
          <h2 className={styles.title}>
            A inversão.
          </h2>
          <p className={styles.body}>
            Não é &ldquo;mais uma plataforma&rdquo;. É a recolocação do artista no centro da
            cadeia — e a delegação da intermediação a uma infraestrutura que não
            compete pelo mesmo público.
          </p>
        </header>

        <div className={styles.pillars}>
          {PILLARS.map((p) => (
            <article key={p.n} className={styles.pillar}>
              <span className={styles.pillarNumber}>{p.n}</span>
              <h3 className={styles.pillarTitle}>{p.title}</h3>
              <p className={styles.pillarBody}>{p.body}</p>
              <p className={styles.pillarRewrite}>
                <span className={styles.pillarRewriteLabel}>Em uma frase</span>
                <span className={styles.pillarRewriteText}>{p.rewrite}</span>
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
