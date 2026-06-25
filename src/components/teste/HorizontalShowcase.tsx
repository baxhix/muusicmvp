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
  details: string;
}

// Mock provisório — imagens locais em /public. Trocar por arte definitiva
// + copy real quando o conteúdo de cada vertical existir.
const ITEMS: ShowcaseItem[] = [
  {
    title: 'Lives',
    desc: 'Shows e Q&As ao vivo, só pra quem é de dentro.',
    img: '/xp-01.jpg',
    details:
      'Transmissões ao vivo exclusivas: shows, ensaios e Q&As em tempo real, com chat só pra superfãs e replays liberados depois. Você entra na sala antes de todo mundo.',
  },
  {
    title: 'Backstage',
    desc: 'Os bastidores que mais ninguém vê.',
    img: '/xp-02.jpg',
    details:
      'Fotos e vídeos do camarim, da passagem de som e da estrada — o lado da rotina do artista que o público geral nunca enxerga. Conteúdo cru, direto da fonte.',
  },
  {
    title: 'Grupos fechados',
    desc: 'Comunidades privadas com o artista.',
    img: '/xp-03.jpg',
    details:
      'Comunidades privadas pra trocar com o artista e com outros superfãs, sem ruído e sem algoritmo. Enquetes, recados e decisões tomadas junto com quem mais importa.',
  },
  {
    title: 'Pré-lançamentos',
    desc: 'Ouça antes de todo mundo.',
    img: '/ana-01.webp',
    details:
      'Acesso antecipado a singles, clipes e novidades antes do lançamento oficial — e a chance de reagir e influenciar o que vem por aí.',
  },
  {
    title: 'Mídia direcionada',
    desc: 'Conteúdo feito sob medida pra você.',
    img: '/ana-02.webp',
    details:
      'Recomendações e conteúdos selecionados com base no que você curte, ouve e acompanha. O Fanverse aprende com você pra te mostrar o que importa.',
  },
];

export default function HorizontalShowcase() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Distância horizontal a percorrer = largura total da track menos a
  // viewport. Medida no cliente (depende de fontes/imagens/breakpoint).
  const [travel, setTravel] = useState(0);
  // Offset inicial: a track começa deslocada PRA DIREITA (x positivo) — os
  // cards entram da direita e o trajeto fica mais longo. Per feedback
  // "deixe o início mais à direita pra percorrer mais o trajeto".
  const [startX, setStartX] = useState(0);
  // Card com detalhes abertos (overlay por cima da própria imagem). null =
  // nenhum aberto. Per feedback "Ver mais discreto que mostra detalhes por
  // cima do mesmo card".
  const [openIdx, setOpenIdx] = useState<number | null>(null);

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
  // Começa em +startX (track empurrada pra direita) e termina em -travel
  // (último card encostado na borda direita). Distância total percorrida =
  // startX + travel.
  const x = useTransform(smooth, [0, 1], [startX, -travel]);

  useEffect(() => {
    const track = trackRef.current;
    const calc = () => {
      if (!track) return;
      setTravel(Math.max(0, track.scrollWidth - window.innerWidth));
      // ~55% da viewport de respiro inicial à esquerda — começa bem mais à
      // direita sem jogar o 1º card totalmente pra fora da tela.
      setStartX(Math.round(window.innerWidth * 0.55));
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
      style={{ height: `calc(100vh + ${travel + startX}px)` }}
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
                {/* "Ver mais" discreto — abre os detalhes por cima do card. */}
                <button
                  type="button"
                  className={styles.cardMore}
                  onClick={() => setOpenIdx(i)}
                  aria-expanded={openIdx === i}
                >
                  Ver mais
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>

              {/* Detalhes — overlay POR CIMA da mesma imagem do card (scrim
               *  escuro + blur, a foto fica esmaecida atrás). Toggle por
               *  opacidade. */}
              <div
                className={`${styles.cardDetails} ${openIdx === i ? styles.cardDetailsOpen : ''}`}
                role="group"
                aria-label={`Detalhes — ${item.title}`}
              >
                <button
                  type="button"
                  className={styles.cardDetailsClose}
                  onClick={() => setOpenIdx(null)}
                  aria-label="Fechar detalhes"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <h4 className={styles.cardDetailsTitle}>{item.title}</h4>
                <p className={styles.cardDetailsText}>{item.details}</p>
              </div>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
