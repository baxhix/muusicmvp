'use client';

import { useDisplaySetting, DISPLAY_KEYS } from '@/hooks/useDisplaySetting';

/**
 * Wrapper que esconde APENAS os triggers (ícones de acesso) de
 * brainstorm da tela inicial quando o user desativa em
 * `Configurações → Exibição → Recursos em teste`.
 *
 * Per product feedback "ao optar por ocultar Recursos em teste,
 * não oculte a funcionalidade, oculte apenas o ícone do mapa e
 * mantenha a funcionalidade visível" — o toggle agora é só sobre
 * affordances de descoberta, não sobre as features em si.
 *
 * Vivem dentro dele (em /app/page.tsx):
 *   - BrainstormPanel (lightbulb + drawer de flags)
 *   - SuperliveTrigger / CollectiveListeningTrigger /
 *     ShowLiveTrigger / FindMyLoveTrigger (ícones flutuantes
 *     no mapa)
 *
 * FORA do gate (sempre renderizando, gateados pelos próprios
 * flags internos):
 *   - MapSimulationLayer / MapPulses / SimulationHUD
 *     (checam `flags.mapSimulation` e retornam null sozinhos)
 *   - MapZoomIndicator (toggle separado: DISPLAY_KEYS.zoomIndicator)
 *
 * Comportamento atual do toggle:
 *  - false → ícones somem do mapa, mas features ativas continuam
 *    rodando (ex: Map Simulation segue renderizando dots/avatares)
 *  - true → ícones voltam, user pode reabrir o painel pra
 *    ligar/desligar features individualmente
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
