'use client';

import { api, ApiError } from '@/lib/api/client';

export type MapVisibilityReason = 'denied' | 'unavailable' | 'no_city' | 'error';

export type MapVisibilityResult = { ok: true } | { ok: false; reason: MapVisibilityReason };

/**
 * Pede a geolocalização do navegador. Resolve (nunca rejeita) com as
 * coords ou um motivo de falha. Usar SEMPRE a partir de um gesto do
 * usuário (clique no toggle) — é o contexto em que o prompt do navegador
 * aparece de forma confiável.
 */
function getBrowserCoords(): Promise<
  { lat: number; lng: number } | { error: 'denied' | 'unavailable' }
> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({ error: 'unavailable' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        resolve({ error: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/**
 * Liga/desliga a visibilidade no mapa ("Visível no mapa" / switch online).
 *
 * O bug que isso corrige: ligar SÓ o consentimento (PATCH location-consent)
 * nunca colocava o usuário no mapa, porque `listOnlineUsers` exige lat/lng
 * não-nulos e a captura das coords ficava num effect PASSIVO
 * (useLocationSync) que no desktop quase nunca dispara o prompt do
 * navegador. Resultado: switch ON + coords NULL = invisível em silêncio.
 *
 * Aqui a captura roda DENTRO do gesto do toggle e grava coords +
 * consentimento de uma vez (POST /api/me/location grantConsent), que é
 * o que efetivamente coloca o usuário no mapa.
 *
 *   ON  → captura coords no gesto → POST (coords + consent). Se a
 *         geolocalização (ou a cidade) falhar, NÃO liga o flag e retorna
 *         {ok:false, reason} pro chamador reverter o switch e avisar.
 *   OFF → PATCH consent:false (coords aproximadas ficam guardadas mas
 *         escondidas; religar mostra na hora).
 */
export async function setMapVisibility(next: boolean): Promise<MapVisibilityResult> {
  if (!next) {
    await api.patch('/api/me/location-consent', { consent: false });
    return { ok: true };
  }

  const coords = await getBrowserCoords();
  if ('error' in coords) return { ok: false, reason: coords.error };

  try {
    await api.post('/api/me/location', {
      lat: coords.lat,
      lng: coords.lng,
      grantConsent: true,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      return { ok: false, reason: 'no_city' };
    }
    return { ok: false, reason: 'error' };
  }
}

/** Mensagem amigável pra cada motivo de falha ao tentar aparecer no mapa. */
export function mapVisibilityErrorMessage(reason: MapVisibilityReason): string {
  switch (reason) {
    case 'denied':
      return 'Permita o acesso à localização no navegador pra aparecer no mapa.';
    case 'unavailable':
      return 'Não consegui acessar sua localização agora. Tente de novo.';
    case 'no_city':
      return 'Não encontramos sua cidade a partir da localização. Tente de novo.';
    default:
      return 'Não foi possível te colocar no mapa agora. Tente de novo.';
  }
}
