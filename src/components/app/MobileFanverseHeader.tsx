'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRanking } from '@/hooks/useRanking';
import FanverseCore from '@/components/animations/FanverseCore';
import styles from './MobileFanverseHeader.module.css';

/** Imagens da Ana que se alternam no header (crossfade a cada 15s). */
const HEADER_IMAGES = [
  '/ana-01-header.webp',
  '/ana-02-header.webp',
  '/ana-03-header.webp',
];
const HEADER_ROTATE_MS = 15000;

/**
 * Header mobile — VARIAÇÃO 2 (A/B).
 *
 * Adapta o card "Fanverse Ana Castela" do desktop (fold do ArtistBox)
 * pra uma experiência nativa de mobile: imagem da Ana à esquerda,
 * gradiente preto por cima pra contraste, conteúdo sobreposto
 * (Fanverse · Ana Castela + Fanpoints + rank) e o orbe (FanverseCore)
 * à direita — mesma linguagem visual do desktop.
 *
 * Gatilhos reaproveitados:
 *   - orbe → `app:open-fanverse-search`
 *   - Fanpoints → `app:open-ranking-store` (Ranking Fanverse)
 */
export default function MobileFanverseHeader() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  const { ranking } = useRanking(true);
  const myRank = user ? ranking.findIndex((r) => r.userId === user.id) + 1 : 0;
  const rankBadge = myRank === 1 ? '(Top 1!)' : myRank > 1 ? `(#${myRank}º)` : '';

  // Alterna as 3 imagens da Ana a cada 15s (crossfade via CSS).
  const [imgIdx, setImgIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setImgIdx((i) => (i + 1) % HEADER_IMAGES.length);
    }, HEADER_ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const openSearch = () => {
    try {
      window.dispatchEvent(new CustomEvent('app:open-fanverse-search'));
    } catch {
      /* SSR */
    }
  };
  const openRanking = () => {
    try {
      window.dispatchEvent(
        new CustomEvent('app:open-ranking-store', { detail: { screen: 'ranking' } }),
      );
    } catch {
      /* SSR */
    }
  };

  return (
    <header className={styles.header}>
      {/* 3 imagens da Ana empilhadas; só a ativa fica visível (crossfade). */}
      {HEADER_IMAGES.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt="Ana Castela"
          aria-hidden={i === imgIdx ? undefined : true}
          className={`${styles.heroImg} ${i === imgIdx ? styles.heroImgActive : ''}`}
        />
      ))}
      {/* Gradiente preto pra legibilidade (base + esquerda). */}
      <div className={styles.overlay} aria-hidden="true" />

      {/* Conteúdo sobreposto, alinhado embaixo à esquerda. */}
      <div className={styles.content}>
        <span className={styles.eyebrow}>Fanverse</span>
        <div className={styles.titleRow}>
          <span className={styles.title}>Ana Castela</span>
        </div>
        <button type="button" className={styles.meta} onClick={openRanking}>
          <span className={styles.metaValue}>
            {fanpoints.toLocaleString('pt-BR')}
          </span>
          <span className={styles.metaLabel}>Fanpoints</span>
          {rankBadge && (
            <span
              className={`${styles.metaRank} ${myRank === 1 ? styles.metaRankTop : ''}`}
            >
              {rankBadge}
            </span>
          )}
        </button>
      </div>

      {/* Orbe à direita — mesma linguagem do desktop. */}
      <button
        type="button"
        className={styles.orb}
        onClick={openSearch}
        aria-label="Abrir Fanverse Search"
      >
        <FanverseCore />
      </button>
    </header>
  );
}
