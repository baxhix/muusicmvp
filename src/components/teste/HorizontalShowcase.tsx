'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import styles from './HorizontalShowcase.module.css';

/**
 * HorizontalShowcase — galeria scroll-horizontal scroll-driven, no padrão do
 * exemplo do Motion (https://motion.dev/examples/react-scroll-horizontal):
 * uma section ALTA (100vh + distância da track) com um miolo STICKY de 100vh
 * onde a track horizontal é transladada em X conforme o progresso do scroll
 * vertical (`useScroll` → `useTransform`). Um `useSpring` suaviza o deslize
 * pra dar uma sensação "fluida" em vez de presa ao pixel do scroll.
 *
 * Cada card é uma imagem de fundo (cover) com gradiente + título por cima.
 * Dados MOCADOS provisoriamente (imagens em /public).
 */
interface ShowcaseItem {
  title: string;
  desc: string;
  img: string;
}

// Mock provisório — imagens locais em /public. Trocar por arte definitiva
// + copy real quando o conteúdo de cada vertical existir.
const ITEMS: ShowcaseItem[] = [
  { title: 'Lives', desc: 'Shows e Q&As ao vivo, só pra quem é de dentro.', img: '/xp-01.jpg' },
  { title: 'Backstage', desc: 'Os bastidores que mais ninguém vê.', img: '/xp-02.jpg' },
  { title: 'Grupos fechados', desc: 'Comunidades privadas com o artista.', img: '/xp-03.jpg' },
  { title: 'Pré-lançamentos', desc: 'Ouça antes de todo mundo.', img: '/ana-01.webp' },
  { title: 'Mídia direcionada', desc: 'Conteúdo feito sob medida pra você.', img: '/ana-02.webp' },
];

export default function HorizontalShowcase() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Distância horizontal a percorrer = largura total da track menos a
  // viewport. Medida no cliente (depende de fontes/imagens/breakpoint).
  const [travel, setTravel] = useState(0);

  // progress 0 quando o TOPO da section encosta no topo da viewport (o pin
  // começa); 1 quando a BASE encosta na base (o pin termina).
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });
  // Spring suaviza o scroll-linking → deslize fluido (não "preso ao pixel").
  const smooth = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.4,
  });
  const x = useTransform(smooth, [0, 1], [0, -travel]);

  useEffect(() => {
    const track = trackRef.current;
    const calc = () => {
      if (track) setTravel(Math.max(0, track.scrollWidth - window.innerWidth));
    };
    calc();
    // Recalcula depois que fontes/imagens assentam (a largura da track muda
    // quando a Borscha carrega ou as imagens definem layout).
    const t = window.setTimeout(calc, 400);
    window.addEventListener('resize', calc);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', calc);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className={styles.scrollSection}
      style={{ height: `calc(100vh + ${travel}px)` }}
      aria-label="O que você desbloqueia no Fanverse"
    >
      <div className={styles.sticky}>
        <motion.div ref={trackRef} style={{ x }} className={styles.track}>
          {ITEMS.map((item, i) => (
            <article key={item.title} className={styles.card}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.img}
                alt=""
                className={styles.cardImg}
                loading="lazy"
                draggable={false}
              />
              <div className={styles.cardOverlay} aria-hidden="true" />
              <span className={styles.cardIndex} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className={styles.cardText}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDesc}>{item.desc}</p>
              </div>
            </article>
          ))}
        </motion.div>

        {/* Barra de progresso — preenche conforme a galeria desliza. */}
        <div className={styles.progressTrack} aria-hidden="true">
          <motion.div className={styles.progressBar} style={{ scaleX: smooth }} />
        </div>
      </div>
    </section>
  );
}
