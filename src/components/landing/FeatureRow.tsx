'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './FeatureRow.module.css';

interface FeatureData {
  num: string;
  titleBefore: string;
  titleEm: string;
  titleAfter: string;
  desc: string;
  media: React.ReactNode;
}

function MediaPulse() {
  return (
    <div className={styles.mediaPulse}>
      <div className={styles.mediaPulseCore} />
      {[
        { top: '32%', left: '28%' },
        { top: '58%', left: '22%' },
        { top: '70%', left: '65%' },
        { top: '36%', left: '78%' },
        { top: '22%', left: '60%' },
      ].map((pos, i) => (
        <span key={i} className={styles.mediaPulseDot} style={pos} />
      ))}
    </div>
  );
}

function MediaBars() {
  const heights = [38, 64, 84, 56, 92, 48, 72, 34, 88, 60];
  return (
    <div className={styles.mediaBars}>
      {heights.map((h, i) => (
        <span
          key={i}
          className={styles.mediaBar}
          style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

function MediaNetwork() {
  return (
    <div className={styles.mediaNet}>
      <span className={`${styles.mediaNetNode} ${styles.mediaNetNodeCenter}`} />
      <span className={styles.mediaNetNode} style={{ top: '22%', left: '28%' }} />
      <span className={styles.mediaNetNode} style={{ top: '30%', right: '22%' }} />
      <span className={styles.mediaNetNode} style={{ bottom: '28%', left: '30%' }} />
      <span className={styles.mediaNetNode} style={{ bottom: '22%', right: '28%' }} />
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}
        preserveAspectRatio="none"
      >
        <line x1="50%" y1="50%" x2="28%" y2="22%" stroke="#A1A1AA" strokeWidth="1" strokeDasharray="2 4" />
        <line x1="50%" y1="50%" x2="78%" y2="30%" stroke="#A1A1AA" strokeWidth="1" strokeDasharray="2 4" />
        <line x1="50%" y1="50%" x2="30%" y2="72%" stroke="#A1A1AA" strokeWidth="1" strokeDasharray="2 4" />
        <line x1="50%" y1="50%" x2="72%" y2="78%" stroke="#A1A1AA" strokeWidth="1" strokeDasharray="2 4" />
      </svg>
    </div>
  );
}

function MediaCommunities() {
  return (
    <div className={styles.mediaNet}>
      {[
        { top: '30%', left: '32%' },
        { top: '28%', left: '50%' },
        { top: '36%', left: '64%' },
        { top: '50%', left: '26%' },
        { top: '52%', left: '70%' },
        { top: '68%', left: '38%' },
        { top: '70%', left: '60%' },
      ].map((pos, i) => (
        <span key={i} className={styles.mediaNetNode} style={{ ...pos, background: 'var(--ink)' }} />
      ))}
      <span className={`${styles.mediaNetNode} ${styles.mediaNetNodeCenter}`} style={{ top: '50%', left: '50%' }} />
    </div>
  );
}

function MediaPrivacy() {
  return (
    <div className={styles.mediaNet}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <circle cx="50" cy="50" r="22" fill="none" stroke="#A1A1AA" strokeWidth="0.6" strokeDasharray="3 3" />
        <circle cx="50" cy="50" r="14" fill="none" stroke="#7DD3FC" strokeWidth="0.6" />
        <path d="M44 48 L44 44 Q44 38 50 38 Q56 38 56 44 L56 48 M40 48 L60 48 L60 60 L40 60 Z"
          fill="none" stroke="#F5F5F7" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function MediaPerformance() {
  return (
    <div className={styles.mediaNet}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 200 120" preserveAspectRatio="none">
        <line x1="0" y1="60" x2="200" y2="60" stroke="#1F1F26" strokeDasharray="2 6" />
        <line x1="0" y1="30" x2="200" y2="30" stroke="#1F1F26" strokeDasharray="2 6" />
        <line x1="0" y1="90" x2="200" y2="90" stroke="#1F1F26" strokeDasharray="2 6" />
        <path d="M0,80 Q40,30 80,55 T160,40 L200,20" fill="none" stroke="#7DD3FC" strokeWidth="1.5" />
        <path d="M0,80 Q40,30 80,55 T160,40 L200,20 L200,120 L0,120 Z" fill="rgba(125,211,252,0.08)" />
        <circle cx="200" cy="20" r="3" fill="#7DD3FC" />
      </svg>
    </div>
  );
}

const FEATURES: FeatureData[] = [
  {
    num: '01 — Mapa Vivo',
    titleBefore: 'Veja o mundo ',
    titleEm: 'pulsar',
    titleAfter: ' em tempo real.',
    desc: 'Descubra fãs ao seu redor enquanto eles ouvem. O mapa respira com a energia de quem compartilha o mesmo som — em São Paulo, Tóquio ou num festival no meio do deserto.',
    media: <MediaPulse />,
  },
  {
    num: '02 — Música ao Vivo',
    titleBefore: 'O que ',
    titleEm: 'toca agora',
    titleAfter: ', em todo lugar.',
    desc: 'Sincronizado com sua conta Amazon Music. Descubra o que o planeta inteiro está ouvindo neste exato momento, entre no ritmo e compartilhe o que está te movendo.',
    media: <MediaBars />,
  },
  {
    num: '03 — Match por Afinidade',
    titleBefore: 'Conexões que vão ',
    titleEm: 'além',
    titleAfter: ' das curtidas.',
    desc: 'Um algoritmo que lê nuances. Conecta você a fãs com gosto parecido — não pelo que postam, mas pelo que realmente move cada um quando ninguém está olhando.',
    media: <MediaNetwork />,
  },
  {
    num: '04 — Comunidades',
    titleBefore: 'Fandoms que ',
    titleEm: 'viram cultura',
    titleAfter: '.',
    desc: 'Espaços vivos para quem vive o mesmo universo. Conversas, encontros, criações, manifestos — tudo o que acontece quando fãs deixam de ser só audiência.',
    media: <MediaCommunities />,
  },
  {
    num: '05 — Privacidade',
    titleBefore: 'Você decide o que ',
    titleEm: 'dividir',
    titleAfter: '.',
    desc: 'Compartilhe o que quiser, com quem quiser, quando quiser. Privacidade como base — não como configuração extra escondida em algum menu.',
    media: <MediaPrivacy />,
  },
  {
    num: '06 — Performance',
    titleBefore: 'Construído para ',
    titleEm: 'escala global',
    titleAfter: '.',
    desc: 'Instantâneo no seu bolso, do início ao fim. 60fps em qualquer rede, sincronização em tempo real, e um backend pensado para mover milhões de batidas por segundo.',
    media: <MediaPerformance />,
  },
];

function FeatureRowItem({ feature, index }: { feature: FeatureData; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <article
      ref={ref}
      className={`${styles.row} ${visible ? styles.rowVisible : ''}`}
      style={{ ['--row-index' as string]: index }}
    >
      <div className={styles.media}>
        {feature.media}
      </div>
      <div className={styles.content}>
        <span className={styles.num}>{feature.num}</span>
        <h3 className={styles.title}>
          {feature.titleBefore}
          <em>{feature.titleEm}</em>
          {feature.titleAfter}
        </h3>
        <p className={styles.desc}>{feature.desc}</p>
      </div>
    </article>
  );
}

export default function FeaturesSection() {
  return (
    <section className={styles.section} id="features">
      <div className={styles.stackWrapper}>
        <div className={styles.stack}>
          {FEATURES.map((f, i) => (
            <FeatureRowItem key={i} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
