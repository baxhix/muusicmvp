'use client';

import { useDisplaySetting, DISPLAY_KEYS } from '@/hooks/useDisplaySetting';

/**
 * Wrapper que esconde todos os triggers/painéis de brainstorm
 * da tela inicial quando o user desativa em `Configurações →
 * Exibição → Recursos em teste`. Per product feedback "os itens
 * de brainstorm devem ter o mesmo comportamento para sairem da
 * tela inicial".
 *
 * Vivem dentro dele (em /app/page.tsx):
 *   - BrainstormPanel (trigger + drawer de flags)
 *   - SuperliveTrigger / CollectiveListeningTrigger /
 *     ShowLiveTrigger / FindMyLoveTrigger
 *   - MapSimulationLayer / MapPulses / SimulationHUD
 *
 * MapZoomIndicator tem toggle separado próprio
 * (DISPLAY_KEYS.zoomIndicator), não é gateado aqui.
 *
 * Quando o toggle vai pra false:
 *  - Os triggers visuais somem (botões de coração, lightbulb, etc.)
 *  - As features ativas (simulation, pulses) também desmontam,
 *    liberando GPU/memória.
 *  - Reativando: re-monta tudo no estado em que estava (flags
 *    individuais do BrainstormPanel não são tocadas).
 */
export default function BrainstormGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [show] = useDisplaySetting(DISPLAY_KEYS.brainstormTriggers, true);
  if (!show) return null;
  return <>{children}</>;
}
