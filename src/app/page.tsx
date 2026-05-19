'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/landing/Header';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeatureRow';
import Footer from '@/components/landing/Footer';
import styles from './page.module.css';

/** Minimal landing toggle — when `true` the page collapses to
 *  just the logo (in the Header) + headline (in the Hero) +
 *  one enter button. Per product feedback ("depois da Hero
 *  section, oculte todo o conteúdo. Vamos deixar apenas o
 *  Headline, logo e um botão de entrar"). Flip to `false` to
 *  restore the full Features + LivePulse + Vision + Footer
 *  flow. The same flag is mirrored inside HeroSection and
 *  Header so the three files toggle together.
 *
 *  The unused locals below (LivePulseSection + LIVE_CARDS)
 *  are kept intact for the restore path. */
const MINIMAL_LANDING = true;

const LIVE_CARDS = [
  { num: '5.434', text: 'pessoas online agora.' },
  { pre: 'Ana Castela', text: 'bombando no Brasil.' },
  { pre: 'Resenha da Muierada', text: 'explodindo na região Sul.' },
  { num: '128', text: 'cidades em tempo real.' },
  { pre: 'Tropicália reloaded', text: 'subindo em Lisboa.' },
  { num: '9 / 10', text: 'fãs descobriram um novo som hoje.' },
];

function LivePulseSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [leavingIdx, setLeavingIdx] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setLeavingIdx(activeIdx);
      const next = (activeIdx + 1) % LIVE_CARDS.length;
      setTimeout(() => {
        setActiveIdx(next);
        setLeavingIdx(null);
      }, 850);
    }, 3500);
    return () => clearInterval(id);
  }, [activeIdx]);

  return (
    <section className={styles.liveSection}>
      <div className={styles.liveNoise} aria-hidden="true" />
      <div className={styles.liveInner}>
        <div className={styles.liveEyebrow}>
          <span className={styles.liveEyebrowDot} aria-hidden="true" />
          <span className={styles.liveEyebrowText}>AO VIVO · AGORA · 24/7</span>
        </div>

        <div className={styles.liveStack} aria-live="polite">
          {LIVE_CARDS.map((card, i) => {
            const isActive = i === activeIdx;
            const isLeaving = i === leavingIdx;
            return (
              <div
                key={i}
                className={`${styles.liveCard} ${isActive ? styles.liveCardActive : ''} ${isLeaving ? styles.liveCardLeaving : ''}`}
                aria-hidden={!isActive}
              >
                {card.num && <span className={styles.liveCardNum}>{card.num}</span>}
                {card.pre && <span className={styles.liveCardPre}>{card.pre}</span>}
                <span className={styles.liveCardText}>{card.text}</span>
              </div>
            );
          })}
        </div>

        <div className={styles.liveMeta}>
          <div className={styles.liveMetaItem}>
            <span className={styles.liveMetaDot} aria-hidden="true" />
            atualizado em tempo real
          </div>
          <div className={styles.liveMetaItem}>
            <span className={styles.liveMetaSep}>/</span>
            cruzando 124 países e 9.7M escutas/h
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.page} data-page="landing">
      <Header />
      <HeroSection />

      {/* Everything BELOW the hero is gated by MINIMAL_LANDING so
          flipping the flag restores the full marketing flow. */}
      {!MINIMAL_LANDING && (
        <>
          <FeaturesSection />

          <LivePulseSection />

          {/* Vision */}
          <section className={styles.section}>
            <div className={styles.vision}>
              <p className={styles.visionQuote}>
                Música é a única língua que cada um entende{' '}
                <em>à sua maneira</em> — e ainda assim, nos une todos.
              </p>
            </div>
          </section>

          <Footer />
        </>
      )}
    </div>
  );
}
