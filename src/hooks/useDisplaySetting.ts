'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Toggle UI booleano persistido em `localStorage` + sincronizado
 * entre componentes via um `CustomEvent('app:display-toggle')`.
 *
 * Por que não usar AppShellContext: estes flags pertencem a
 * "preferência de exibição" do user e precisam sobreviver a
 * navegação, refresh, e ser leitura barata pra components
 * espalhados (MapZoomIndicator, BrainstormPanel, etc.) que
 * podem montar/desmontar isolados do shell.
 *
 * Por que evento custom em vez de window.storage: o evento
 * `storage` só dispara entre TABS diferentes, não no mesmo doc.
 * Pra reagir ao toggle local imediatamente, dispatchamos nosso
 * próprio evento síncrono.
 *
 * Uso:
 *   const [show, setShow] = useDisplaySetting('display:zoom', true);
 *   if (!show) return null;
 */

/** Payload do evento custom. */
interface DisplayToggleDetail {
  key: string;
  value: boolean;
}

const EVENT_NAME = 'app:display-toggle';

function readStored(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

export function useDisplaySetting(
  key: string,
  defaultValue: boolean,
): [boolean, (next: boolean) => void] {
  /* SSR-safe: usa fallback no primeiro render (server) E primeiro
   * client paint, depois sincroniza com localStorage via useEffect.
   * Isso evita hydration mismatch quando a flag está salva como
   * `false` mas o SSR rendeu o default `true` (ou vice-versa). */
  const [value, setValue] = useState<boolean>(defaultValue);

  /* Hidrata o valor real do localStorage após mount. */
  useEffect(() => {
    setValue(readStored(key, defaultValue));
  }, [key, defaultValue]);

  /* Escuta toggles de outros consumers (event custom sync). */
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<DisplayToggleDetail>).detail;
      if (detail?.key === key) setValue(detail.value);
    };
    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  }, [key]);

  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        /* localStorage indisponível (modo privado, quota) — segue
         * funcionando in-memory durante a sessão. */
      }
      try {
        window.dispatchEvent(
          new CustomEvent<DisplayToggleDetail>(EVENT_NAME, {
            detail: { key, value: next },
          }),
        );
      } catch { /* SSR / detached — ignore */ }
    },
    [key],
  );

  return [value, update];
}

/* Chaves canônicas — centralizadas pra que múltiplos consumers
 * apontem pra mesma string sem typo. */
export const DISPLAY_KEYS = {
  /** Card flutuante com o nível de zoom atual do mapa. */
  zoomIndicator: 'display:zoomIndicator',
  /** Triggers de brainstorm (Brainstorm panel + Find My Love +
   * Superlive + Collective Listening + Show ao vivo). */
  brainstormTriggers: 'display:brainstormTriggers',
} as const;
