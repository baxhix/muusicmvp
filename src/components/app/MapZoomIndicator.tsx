'use client';

import { useEffect, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { globeStore } from '@/lib/globeStore';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { useDisplaySetting, DISPLAY_KEYS } from '@/hooks/useDisplaySetting';
import styles from './SimulationHUD.module.css';

/* ============================================================
 * MAP ZOOM INDICATOR — debug HUD mostrando o nível de zoom atual.
 *
 * Per feedback "é possível deixar na tela a informação de qual
 * nível de zoom eu estou conforme eu navego para ter melhor
 * entendimento?".
 *
 * Útil pra entender qual faixa de zoom está disparando qual
 * comportamento (heatmap, clusters, dots, pulses XXL/XL/L/M…).
 *
 * Gated pelo mesmo flag mapSimulation — só aparece quando o
 * sandbox tá on (i.e. brainstorm owner). Não vai pra usuário
 * final.
 *
 * Tier label calculado pelos thresholds que os layers usam:
 *   <5    → continente (XXL pulses, sem heatmap)
 *   5-7   → país (XL/L/M pulses, heatmap soft entrando)
 *   8-10  → região (clusters + dots intermediários)
 *   ≥11   → cidade (dots individuais por tier + avatares)
 * ============================================================ */

function zoomTier(z: number): string {
  if (z < 5) return 'continente';
  if (z < 8) return 'país';
  if (z < 11) return 'região';
  return 'cidade';
}

export default function MapZoomIndicator() {
  const { flags } = useBrainstormFlags();
  /* Toggle de exibição persistido em localStorage. User pode
   * esconder o card via Configurações → Exibição → Indicador
   * de zoom. Per product feedback "quero remover ele da tela". */
  const [showIndicator] = useDisplaySetting(DISPLAY_KEYS.zoomIndicator, true);
  const enabled = flags.mapSimulation && showIndicator;
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let currentMap: MapboxMap | null = null;
    let handler: (() => void) | null = null;

    const detach = () => {
      if (currentMap && handler) {
        try {
          currentMap.off('zoom', handler);
          currentMap.off('moveend', handler);
        } catch { /* mapa destruído */ }
      }
      currentMap = null;
      handler = null;
    };

    const attach = (mapUnknown: unknown | null) => {
      if (!mapUnknown) {
        detach();
        setZoom(null);
        return;
      }
      detach();
      const map = mapUnknown as MapboxMap;
      currentMap = map;
      handler = () => setZoom(map.getZoom());
      handler();                       // snapshot inicial
      map.on('zoom', handler);
      map.on('moveend', handler);      // pega caso só mexa lat/lng
    };

    const unsubscribe = globeStore.subscribeMapInstance(attach);

    return () => {
      unsubscribe();
      detach();
    };
  }, [enabled]);

  if (!enabled || zoom === null) return null;

  return (
    <div
      className={styles.zoomIndicator}
      role="status"
      aria-live="off"   // muda muito, evitar spam pra screen readers
    >
      <span className={styles.zoomNum}>{zoom.toFixed(1)}</span>
      <span className={styles.zoomTier}>{zoomTier(zoom)}</span>
    </div>
  );
}
