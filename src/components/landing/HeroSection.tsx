'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import styles from './HeroSection.module.css';

const HeroGlobe = dynamic(() => import('./HeroGlobe'), { ssr: false });

const PHRASES = [
  'O universo dos superfãs.',
  'Descubra quem ouve o que você ouve.',
  'Sua tribo, em qualquer tela.',
  'Música une o mundo.',
];

const GLOBE_USERS = [
  {
    name: 'Diógenis Silva',
    city: 'São Paulo',
    song: 'Boiadeira',
    artist: 'Ana Castela',
    initials: 'DS',
    bg: 'linear-gradient(135deg,#1a3050,#2d6aad)',
    style: { right: '24%', top: 'calc(8% + 80px)' },
    alignRight: true,
  },
  {
    name: 'Mariana Lopes',
    city: 'Rio de Janeiro',
    song: 'Olha Onde Eu Tô',
    artist: 'Ana Castela',
    initials: 'ML',
    bg: 'linear-gradient(135deg,#501a30,#ad2d6a)',
    style: { left: '14%', top: 'calc(10% + 80px)' },
    alignRight: false,
  },
  {
    name: 'João Pedro',
    city: 'Fortaleza',
    song: 'Erramos',
    artist: 'Gusttavo Lima',
    initials: 'JP',
    bg: 'linear-gradient(135deg,#1a4030,#2dad6a)',
    style: { right: '16%', top: '78%' },
    alignRight: true,
  },
];

export default function HeroSection() {
  const [displayText, setDisplayText] = useState('');
  const phraseRef = useRef(0);
  const charRef = useRef(0);
  const dirRef = useRef<'typing' | 'deleting'>('typing');

  useEffect(() => {
    let raf: ReturnType<typeof setTimeout>;
    const tick = () => {
      const phrase = PHRASES[phraseRef.current];
      if (dirRef.current === 'typing') {
        charRef.current++;
        setDisplayText(phrase.slice(0, charRef.current));
        if (charRef.current >= phrase.length) {
          dirRef.current = 'deleting';
          raf = setTimeout(tick, 3200);   // pausa maior na frase completa
          return;
        }
        raf = setTimeout(tick, 100);      // ~80% mais lento que antes
      } else {
        charRef.current--;
        setDisplayText(phrase.slice(0, charRef.current));
        if (charRef.current <= 0) {
          phraseRef.current = (phraseRef.current + 1) % PHRASES.length;
          dirRef.current = 'typing';
          raf = setTimeout(tick, 700);    // pausa antes da próxima frase
          return;
        }
        raf = setTimeout(tick, 55);       // delete mais lento e visível
      }
    };
    raf = setTimeout(tick, 700);
    return () => clearTimeout(raf);
  }, []);

  return (
    <section className={styles.hero}>
      {/* Headline block */}
      <div className={styles.copy}>
        <h1 className={styles.headline} aria-live="polite">
          <span>{displayText}</span>
          <span className={styles.cursor} aria-hidden="true" />
        </h1>
      </div>

      <p className={styles.sub}>Descubra o que o mundo está ouvindo, em tempo real.</p>

      {/* Hero CTAs */}
      <div className={styles.heroCta}>
        <Link href="/auth?mode=signup" className={styles.heroCtaPrimary}>
          Entrar no Fanverse
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Link href="/auth?mode=login" className={styles.heroCtaGhost}>
          Já sou da tribo
        </Link>
      </div>

      {/* Globe stage */}
      <div className={styles.globeStage} aria-label="Mapa global de fãs em tempo real">
        <div id="hero-globe-container" className={styles.globeContainer}>
          <HeroGlobe />
        </div>

        {/* Globe frame tags */}
        <div className={styles.globeFrame} aria-hidden="true">
          <span className={`${styles.globeTag} ${styles.globeTagTL}`}>Live · Global</span>
          <span className={`${styles.globeTag} ${styles.globeTagBR}`}>2.4M fans online</span>
        </div>

        {/* Connected users */}
        {GLOBE_USERS.map((u, i) => (
          <div
            key={i}
            className={`${styles.globeUser} ${u.alignRight ? styles.globeUserRight : ''}`}
            style={u.style as React.CSSProperties}
          >
            <div className={styles.globeUserAvatar} style={{ background: u.bg }}>
              <span className={styles.globeUserInitials}>{u.initials}</span>
            </div>
            <div className={styles.globeUserBadge}>
              <div className={styles.globeUserInfoRow}>
                <span className={styles.globeUserName}>{u.name}</span>
                <span className={styles.globeUserCity}>· {u.city}</span>
              </div>
              <div className={styles.globeUserSongRow}>
                <span className={styles.globeUserAudio} aria-hidden="true">
                  <span /><span /><span />
                </span>
                <span className={styles.globeUserSong}>{u.song}</span>
                <span className={styles.globeUserDotSep}>·</span>
                <span className={styles.globeUserArtist}>{u.artist}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mini player */}
      <div className={styles.miniPlayer} role="region" aria-label="Mini Player">
        <div className={styles.mpTop}>
          <div className={styles.mpArt} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.mpCover}
              src="https://i.scdn.co/image/ab67616d0000b273148cc2bf987ec2f4964d49fa"
              alt="Olha Onde Eu Tô - Ana Castela"
            />
          </div>
          <div className={styles.mpMeta}>
            <span className={styles.mpTitle}>Olha Onde Eu Tô</span>
            <span className={styles.mpArtist}>
              <span className={styles.mpArtistDot} aria-hidden="true" />
              Ana Castela
            </span>
          </div>
        </div>
        <div className={styles.mpProgress}>
          <span className={styles.mpTime}>0:42</span>
          <div className={styles.mpBar} role="slider" aria-label="Progresso" aria-valuenow={20} aria-valuemin={0} aria-valuemax={100}>
            <div className={styles.mpBarFill} style={{ width: '20%' }} />
          </div>
          <span className={`${styles.mpTime} ${styles.mpTimeEnd}`}>3:24</span>
          <div className={styles.mpWave} aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={styles.mpWaveBar} />
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}
