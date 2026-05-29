'use client';

import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { useSimulationData } from '@/lib/mapSimulation';
import HeartsCascade from './HeartsCascade';
import styles from './SimulationHUD.module.css';

/**
 * SimulationHUD — overlays informativos do modo simulação.
 *
 * Renderiza quando o flag `mapSimulation` está on:
 *
 *   1. Contador top-center "X online agora" com dot verde pulsante.
 *      Comunica que a rede está viva.
 *   2. HeartsCascade montado pra suportar o efeito de reaction
 *      disparado pelo click no avatar do reveal.
 *
 * O card "Cidade X bombando" foi removido per feedback do usuário —
 * tinha rotação a cada 12s + flyTo no click, mas competia visualmente
 * com o reveal de avatares no zoom alto.
 *
 * Tudo client-side, zero call de backend.
 */

export default function SimulationHUD() {
  const { flags } = useBrainstormFlags();
  const enabled = flags.mapSimulation;
  const data = useSimulationData();

  if (!enabled) return null;

  // Formatador pt-BR pra "12.847 fãs", "3.000".
  const fmt = (n: number) => n.toLocaleString('pt-BR');

  return (
    <>
      {/* HeartsCascade montado SÓ no contexto da simulação (gated
       * pelo flag mapSimulation). Necessário pro efeito de envio
       * de reaction (❤️ 👋 💬 👀) disparado pelo click no avatar
       * do reveal. A instância global em /app/layout segue
       * desmontada pra não dispar cascatas em eventos não-mocados. */}
      <HeartsCascade />

      <div className={styles.counter} role="status" aria-live="polite">
        <span className={styles.counterDot} aria-hidden="true" />
        <span className={styles.counterNum}>{fmt(data.activeNow)}</span>
        <span className={styles.counterLbl}>online agora</span>
      </div>
    </>
  );
}
