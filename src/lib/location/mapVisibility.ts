'use client';

import { api, ApiError } from '@/lib/api/client';

export type MapVisibilityReason = 'denied' | 'unavailable' | 'no_city' | 'error';

/**
 * Resultado do toggle.
 *   - ok:false        → falha de rede ao gravar o flag → o chamador reverte
 *                       o switch.
 *   - ok:true         → o consentimento foi gravado como pedido (o switch
 *                       fica onde o usuário colocou — NUNCA reverte).
 *   - needsLocation   → ligou o flag mas não há coords (geoloc negada/falhou):
 *                       o chamador mantém o switch ON e mostra um aviso com
 *                       `reason` explicando que precisa permitir a localização
 *                       pra de fato aparecer no mapa.
 */
export type MapVisibilityResult = {
  ok: boolean;
  needsLocation?: boolean;
  reason?: MapVisibilityReason;
};

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
 * O switch SEMPRE reflete a escolha do usuário (liga e fica ligado). A
 * captura de coords é só uma ação best-effort que acontece quando ainda
 * não há coords salvas:
 *
 *   OFF                       → PATCH consent:false.
 *   ON  + já tem coords       → PATCH consent:true (instantâneo, sem prompt).
 *                               É o caso comum de quem já compartilhou a
 *                               localização antes — não relê o GPS toda vez
 *                               (era essa a regressão que travava o switch).
 *   ON  + sem coords          → PATCH consent:true e, no mesmo gesto, tenta
 *                               capturar a localização (prompt confiável) +
 *                               grava coords (POST grantConsent). Se a geoloc
 *                               falhar, o flag continua ON e retornamos
 *                               needsLocation:true pro chamador avisar.
 *
 * `hasCoords` vem do auth user (lat/lng != null) — evita o prompt
 * desnecessário pra quem já tem coords.
 */
export async function setMapVisibility(
  next: boolean,
  opts?: { hasCoords?: boolean },
): Promise<MapVisibilityResult> {
  if (!next) {
    await api.patch('/api/me/location-consent', { consent: false });
    return { ok: true };
  }

  // ON — honra o toggle ligando o flag primeiro (vale mesmo se a captura
  // de coords falhar depois).
  await api.patch('/api/me/location-consent', { consent: true });

  // Já tem coords → nada mais a fazer (instantâneo, sem prompt).
  if (opts?.hasCoords) return { ok: true };

  // Sem coords → captura no gesto pra de fato entrar no mapa.
  const coords = await getBrowserCoords();
  if ('error' in coords) {
    return { ok: true, needsLocation: true, reason: coords.error };
  }
  try {
    await api.post('/api/me/location', {
      lat: coords.lat,
      lng: coords.lng,
      grantConsent: true,
    });
    return { ok: true };
  } catch (err) {
    const reason: MapVisibilityReason =
      err instanceof ApiError && err.status === 422 ? 'no_city' : 'error';
    return { ok: true, needsLocation: true, reason };
  }
}

/** Mensagem amigável pra cada motivo de falha ao tentar aparecer no mapa. */
export function mapVisibilityErrorMessage(reason: MapVisibilityReason): string {
  switch (reason) {
    case 'denied':
      return 'Você está visível, mas precisa permitir a localização no navegador pra aparecer no mapa.';
    case 'unavailable':
      return 'Você está visível, mas não consegui acessar sua localização agora.';
    case 'no_city':
      return 'Você está visível, mas não encontramos sua cidade a partir da localização.';
    default:
      return 'Você está visível, mas não consegui salvar sua localização agora.';
  }
}
