import styles from './Diagnostico.module.css';

/**
 * Section 2 — Diagnóstico (foco em superfãs).
 *
 * Refeito per product feedback "dando ênfase nos números de
 * superfãs e como eles podem auxiliar na carreira". A tese
 * central da página passa a ser: 15% dos ouvintes (os
 * superfãs) já sustentam a maior parte da receita real do
 * artista, mas a indústria atual não os identifica nem
 * monetiza diretamente.
 *
 * 3 blocos:
 *   1. Header — manifesto "Não são todos os fãs. São os
 *      superfãs."
 *   2. Stat board — 3 números display gigantes com fonte +
 *      contexto. Conversa direto com empresário/CFO.
 *   3. Outcomes — 3 cards "O que muda na carreira": Tour,
 *      Marca, Receita. Cada um liga o número ao acionável.
 */

interface Stat {
  value: string;
  unit?: string;
  label: string;
  source: string;
}

const STATS: Stat[] = [
  {
    value: '15',
    unit: '%',
    label: 'dos ouvintes carregam a base inteira',
    source:
      'Superfãs — quem ouve mais de 20h/mês e paga acima da média (Goldman/MIDiA, 2024)',
  },
  {
    value: '6',
    unit: '×',
    label: 'a receita de um ouvinte casual',
    source:
      'Spending médio por superfã em merch, ingresso, conteúdo exclusivo (LTV anual)',
  },
  {
    value: '4,2',
    unit: 'B',
    label: 'US$ já gastos fora do streaming',
    source:
      'Mercado anual de superfãs em direct-to-fan globalmente — fora do que chega via DSPs',
  },
];

interface Outcome {
  area: string;
  title: string;
  body: string;
  rewrite: string;
}

const OUTCOMES: Outcome[] = [
  {
    area: 'Tour',
    title: 'Onde tocar deixa de ser palpite.',
    body:
      'Cada superfã está geolocalizado. A roteirização vai pelas cidades que concentram base ativa — não pelo ranking agregado de streams. Vendagem antecipada vira previsível.',
    rewrite: 'Booking decide com mapa.',
  },
  {
    area: 'Marca',
    title: 'Patrocínio com lastro real.',
    body:
      'Sponsor não compra alcance — compra qualidade de audiência. Idade, gasto médio, frequência de engajamento. O pitch deixa de ser "ele tem 4M de seguidores" e vira "ele tem 47k superfãs no SP-RJ-MG".',
    rewrite: 'Vale 3-5× o ticket de mídia.',
  },
  {
    area: 'Receita',
    title: 'Recorrência sem assinatura forçada.',
    body:
      'Fanpoints, drops, conteúdo premium, pre-saves monetizados. O fã engajado decide quanto gastar e em quê. A receita deixa de depender do pico do lançamento e vira compounding mensal.',
    rewrite: 'LTV mensurável, mês a mês.',
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
            Não são todos os fãs.<br />
            <em className={styles.titleAccent}>São os superfãs.</em>
          </h2>
          <p className={styles.body}>
            Os 15% que já pagam por tudo. Que comprariam mais — se a indústria
            soubesse quem são. Por décadas eles foram tratados como métrica de
            vaidade; aqui eles viram <strong>infraestrutura de carreira</strong>.
          </p>
        </header>

        {/* Stat board — 3 números display. Cada um com value
         *  em Borscha bold gigante, unit gradient ao lado, label
         *  curto e source de rodapé em uppercase. */}
        <div className={styles.statBoard}>
          {STATS.map((s, i) => (
            <div key={i} className={styles.stat}>
              <span className={styles.statIndex}>0{i + 1}</span>
              <div className={styles.statValueRow}>
                <span className={styles.statValue}>{s.value}</span>
                {s.unit && <span className={styles.statUnit}>{s.unit}</span>}
              </div>
              <p className={styles.statLabel}>{s.label}</p>
              <p className={styles.statSource}>{s.source}</p>
            </div>
          ))}
        </div>

        {/* Outcomes — como esse dado vira ação concreta. */}
        <div className={styles.outcomes}>
          <h3 className={styles.outcomesTitle}>
            O que muda <em>na carreira</em>.
          </h3>

          <div className={styles.outcomesGrid}>
            {OUTCOMES.map((o) => (
              <article key={o.area} className={styles.outcome}>
                <span className={styles.outcomeArea}>{o.area}</span>
                <h4 className={styles.outcomeTitle}>{o.title}</h4>
                <p className={styles.outcomeBody}>{o.body}</p>
                <p className={styles.outcomeRewrite}>
                  <span className={styles.outcomeRewriteArrow} aria-hidden="true">→</span>
                  <span>{o.rewrite}</span>
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
