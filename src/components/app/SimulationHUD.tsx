'use client';

import { useEffect, useMemo, useState } from 'react';
import { globeStore } from '@/lib/globeStore';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { useSimulationData } from '@/lib/mapSimulation';
import styles from './SimulationHUD.module.css';

/**
 * SimulationHUD — overlays informativos do modo simulação.
 *
 * Renderiza dois elementos quando o flag `mapSimulation` está on:
 *
 *   1. Contador top-center "X mil online agora" com dot verde
 *      pulsante. Comunica que a rede está viva.
 *   2. Card "cidade bombando" bottom-center que rotaciona pelas
 *      5 cidades com mais ativos a cada 12s. Click → flyTo na
 *      cidade (cinematic via globeStore).
 *
 * Tudo client-side, zero call de backend.
 */

const ROTATION_MS = 12_000;
const FLYTO_ZOOM = 9.2;

export default function SimulationHUD() {
  const { flags } = useBrainstormFlags();
  const enabled = flags.mapSimulation;
  const data = useSimulationData();

  // Top-5 cidades com mais ativos pra rotação.
  const hotspots = useMemo(() => data.cities.slice(0, 5), [data.cities]);

  const [rotIdx, setRotIdx] = useState(0);
  useEffect(() => {
    if (!enabled || hotspots.length === 0) return;
    const id = window.setInterval(() => {
      setRotIdx((i) => (i + 1) % hotspots.length);
    }, ROTATION_MS);
    return () => window.clearInterval(id);
  }, [enabled, hotspots.length]);

  if (!enabled) return null;

  const currentHotspot = hotspots[rotIdx] ?? null;

  // Formatador pt-BR pra "12.847 fãs", "3.000".
  const fmt = (n: number) => n.toLocaleString('pt-BR');

  const onHotspotClick = () => {
    if (!currentHotspot) return;
    globeStore.flyTo(currentHotspot.center, FLYTO_ZOOM);
  };

  return (
    <>
      <div className={styles.counter} role="status" aria-live="polite">
        <span className={styles.counterDot} aria-hidden="true" />
        <span className={styles.counterNum}>{fmt(data.activeNow)}</span>
        <span className={styles.counterLbl}>online agora</span>
      </div>

      {currentHotspot && (
        <button
          type="button"
          className={styles.cityCard}
          onClick={onHotspotClick}
          aria-label={`Voar para ${currentHotspot.city}`}
          key={currentHotspot.city /* re-monta a animação ao trocar */}
        >
          <span className={styles.cityFlame} aria-hidden="true">🔥</span>
          <span className={styles.cityBody}>
            <span className={styles.cityLabel}>Cidade bombando</span>
            <span className={styles.cityName}>{currentHotspot.city}</span>
            <span className={styles.cityStats}>
              {fmt(currentHotspot.active)} ativos · {fmt(currentHotspot.superfans)} superfãs
            </span>
          </span>
          <svg
            className={styles.cityChevron}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </>
  );
}
