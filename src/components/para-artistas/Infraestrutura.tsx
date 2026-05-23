import styles from './Infraestrutura.module.css';

/**
 * Section 4 — Infraestrutura.
 *
 * Grid mosaic de 6 capabilities concretas. Cada card mostra:
 *   - ícone-tag (badge SVG simples);
 *   - nome do produto/feature;
 *   - 1 frase explicando.
 *
 * Não é feature-grid genérica — é o "diga ao CFO". As
 * descrições falam em outputs operacionais (conversão,
 * receita, retenção), não em mecanismos. */

interface Capability {
  tag: string;
  title: string;
  body: string;
  icon: 'live' | 'points' | 'presave' | 'globe' | 'arena' | 'api';
}

const ITEMS: Capability[] = [
  {
    tag: 'Live',
    title: 'Comunidade ao vivo',
    body:
      'Lives + Superchat integrados. Conversão ao vivo monetizada por superchat e fila premium — não depende de ad-revenue.',
    icon: 'live',
  },
  {
    tag: 'Fanpoints',
    title: 'Engajamento monetizado',
    body:
      'Sistema de pontos por comportamento. O fã engaja, acumula, troca por experiências. Recorrência sem assinatura forçada.',
    icon: 'points',
  },
  {
    tag: 'Pre-save',
    title: 'Lançamento orquestrado',
    body:
      'Campanhas de pre-save com landing dedicada, captura de email, integração com DSPs. Day-1 de lançamento já é um banco de dados próprio.',
    icon: 'presave',
  },
  {
    tag: 'Geo',
    title: 'Mapa global de fãs',
    body:
      'Cada fã geolocalizado. Decisões de tour, ativação regional e parcerias com selo/distribuidora viram acionáveis — não palpite.',
    icon: 'globe',
  },
  {
    tag: 'Fire Arena',
    title: 'Drops com fila',
    body:
      'Edições limitadas com fila de acesso por fanpoints. Recompensa o engajamento histórico — não quem chega mais rápido.',
    icon: 'arena',
  },
  {
    tag: 'Dev',
    title: 'API + integração',
    body:
      'Todos os endpoints públicos, SDK em JS, webhooks, exportação CSV. O dado nunca fica preso. Auditoria e LGPD by design.',
    icon: 'api',
  },
];

function Icon({ kind }: { kind: Capability['icon'] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'live':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M5.6 18.4a9 9 0 0 1 0-12.8" />
          <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
          <path d="M8.5 15.5a5 5 0 0 1 0-7" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        </svg>
      );
    case 'points':
      return (
        <svg {...common}>
          <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 21.5 12 18 5.5 21.5 7 14.5 2 9.5 9 9 12 2" />
        </svg>
      );
    case 'presave':
      return (
        <svg {...common}>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 0 20" />
          <path d="M12 2a15.3 15.3 0 0 0 0 20" />
        </svg>
      );
    case 'arena':
      return (
        <svg {...common}>
          <path d="M12 2s5 5 5 11a5 5 0 0 1-10 0c0-2.2 1.2-3.8 2.2-5C10.3 6.5 12 2 12 2Z" />
          <path d="M9 16a3 3 0 0 0 6 0c0-1.5-1-2.5-1.5-3.5C13 11 12 10 12 10s-3 3-3 6Z" />
        </svg>
      );
    case 'api':
      return (
        <svg {...common}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
          <line x1="14" y1="4" x2="10" y2="20" />
        </svg>
      );
  }
}

export default function Infraestrutura() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowIndex}>03</span>
            <span className={styles.eyebrowLabel}>Infraestrutura</span>
          </span>
          <h2 className={styles.title}>
            O que vocês ganham<br />operacionalmente.
          </h2>
          <p className={styles.body}>
            Cada capability foi desenhada pra responder uma pergunta operacional
            que aparece na reunião com selo, distribuidora ou patrocinador.
          </p>
        </header>

        <div className={styles.grid}>
          {ITEMS.map((cap) => (
            <article key={cap.tag} className={styles.card}>
              <div className={styles.cardTopRow}>
                <span className={styles.iconBox}>
                  <Icon kind={cap.icon} />
                </span>
                <span className={styles.tag}>{cap.tag}</span>
              </div>
              <h3 className={styles.cardTitle}>{cap.title}</h3>
              <p className={styles.cardBody}>{cap.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
