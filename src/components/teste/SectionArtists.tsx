'use client';

import Sparkles from './Sparkles';
import styles from './SectionArtists.module.css';

/**
 * Section "Para Artistas" — pivô da narrativa do fã pro artista, agora
 * posicionada como SaaS para ESCRITÓRIOS de artistas: headline (84px) +
 * 6 blocos de funcionalidades + um CTA pra agendar demonstração.
 */

interface Feature {
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Base de fãs própria',
    desc: 'Dados primários (1st-party) de quem ouve o artista — identidade, localização e comportamento — sem depender de plataformas de terceiros.',
  },
  {
    title: 'CRM de superfãs',
    desc: 'Segmente a base por engajamento (Top 1, 10, 50, 100), acompanhe o histórico e ative os maiores fãs com relacionamento direto.',
  },
  {
    title: 'Monetização recorrente',
    desc: 'Loja, Fanpoints e produtos resgatáveis: uma linha de receita direta, recorrente e independente do streaming.',
  },
  {
    title: 'Lançamentos & pré-save',
    desc: 'Orquestre drops com pré-save, campanhas segmentadas e push para a base inteira no momento exato do lançamento.',
  },
  {
    title: 'Shows ao vivo & eventos',
    desc: 'Ative a base em turnês e datas com Fire Arena, Superchat e presentes — engajamento em tempo real durante o show.',
  },
  {
    title: 'Relatórios & insights',
    desc: 'Crescimento, retenção e LTV dos fãs em tempo real, com exportação pronta para o time do escritório.',
  },
];

const DEMO_MAILTO =
  'mailto:artistas@fanverse.com.br?subject=Agendar%20uma%20demonstra%C3%A7%C3%A3o%20%E2%80%94%20Fanverse';

export default function SectionArtists() {
  return (
    <section
      id="section-artists"
      data-section="artists"
      className={styles.section}
      aria-label="Para Artistas"
    >
      <Sparkles count={11} seed={47} />

      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.eyebrow}>Fanverse para escritórios</span>
          <h2 className={styles.headline}>Para Artistas</h2>
          <p className={styles.lead}>
            Toda a infraestrutura de relacionamento direto com os fãs — operada
            pelo seu escritório como uma plataforma única.
          </p>
        </header>

        <ul className={styles.grid}>
          {FEATURES.map((f, i) => (
            <li key={f.title} className={styles.card}>
              <span className={styles.cardIndex} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>
            </li>
          ))}
        </ul>

        <div className={styles.ctaWrap}>
          <a href={DEMO_MAILTO} className={styles.cta}>
            Agendar demonstração
          </a>
        </div>
      </div>
    </section>
  );
}
