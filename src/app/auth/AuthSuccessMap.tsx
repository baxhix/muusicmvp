'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import styles from './auth.module.css';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

/* Cidades brasileiras com fãs ativos (mock) — [lng, lat] */
const FAN_DOTS: [number, number][] = [
  [-46.63, -23.55], // São Paulo
  [-43.20, -22.91], // Rio
  [-47.93, -15.78], // Brasília
  [-38.51, -3.72],  // Fortaleza
  [-34.88, -8.05],  // Recife
  [-49.27, -25.43], // Curitiba
  [-51.23, -30.03], // Porto Alegre
  [-48.55, -27.59], // Florianópolis
  [-43.94, -19.92], // Belo Horizonte
  [-60.02, -3.10],  // Manaus
  [-48.36, -10.18], // Palmas
  [-35.21, -5.79],  // Natal
  [-40.30, -20.31], // Vitória
  [-38.50, -12.97], // Salvador
  [-44.30, -2.53],  // São Luís
  [-54.62, -20.46], // Campo Grande
  [-49.25, -16.68], // Goiânia
  [-56.10, -15.60], // Cuiabá
  [-47.06, -22.90], // Campinas
  [-46.32, -23.63], // ABC
];

export default function AuthSuccessMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-50, -14],
      zoom: 3.4,
      pitch: 35,
      bearing: -8,
      interactive: false,
      attributionControl: false,
    });

    map.on('style.load', () => {
      map.addSource('fans', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: FAN_DOTS.map(([lng, lat]) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [lng, lat] },
            properties: {},
          })),
        },
      });

      map.addLayer({
        id: 'fan-glow',
        type: 'circle',
        source: 'fans',
        paint: {
          'circle-radius': 22,
          'circle-color': '#3DDB74',
          'circle-opacity': 0.18,
          'circle-blur': 1,
        },
      });

      map.addLayer({
        id: 'fan-mid',
        type: 'circle',
        source: 'fans',
        paint: {
          'circle-radius': 8,
          'circle-color': '#3DDB74',
          'circle-opacity': 0.5,
          'circle-blur': 0.6,
        },
      });

      map.addLayer({
        id: 'fan-core',
        type: 'circle',
        source: 'fans',
        paint: {
          'circle-radius': 3,
          'circle-color': '#3DDB74',
          'circle-opacity': 0.95,
        },
      });
    });

    /* Subtle slow drift to feel alive */
    let raf = 0;
    const drift = () => {
      const c = map.getCenter();
      map.setCenter([c.lng + 0.012, c.lat]);
      raf = requestAnimationFrame(drift);
    };
    map.on('load', () => {
      raf = requestAnimationFrame(drift);
    });

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
    };
  }, []);

  return (
    <div className={styles.mapBackdrop} aria-hidden="true">
      <div ref={containerRef} className={styles.mapCanvas} />
      <div className={styles.mapBlur} />
      <div className={styles.mapVignette} />
    </div>
  );
}
