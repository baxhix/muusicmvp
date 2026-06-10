'use client';

import { useLocationSync } from '@/hooks/useLocationSync';

/**
 * Montador headless do `useLocationSync` no shell do /app.
 *
 * Histórico: o único consumidor do hook era o `LocateButton`, que foi
 * removido junto com o orb lateral do mapa. Sem nenhum consumidor montado,
 * a captura de localização no cliente parou de rodar — usuários que
 * consentiam (onboarding/Configurações) ficavam com `location_consent=true`
 * mas SEM coords, e a query `listOnlineUsers` (que exige lat/lng não-nulos)
 * os escondia de todos. Este componente restaura o comportamento original
 * ("o prompt do SO dispara após o login"): roda a captura/sync silenciosa
 * pra quem consentiu mas ainda não tem coords. Renderiza null.
 */
export default function LocationSync() {
  useLocationSync();
  return null;
}
