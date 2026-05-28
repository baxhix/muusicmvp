'use client';

import { useState } from 'react';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import ShowLiveStage from './ShowLiveStage';
import styles from './ShowLiveTrigger.module.css';

/**
 * Brainstorm-gated entry point pra feature "Show ao vivo" (Fire Arena).
 *
 * Renderiza uma pílula horizontal abaixo do SuperliveTrigger / Collective-
 * ListeningTrigger no topo da home. Visual: Fire Arena lettering rosa neon
 * em cima de um fundo dark com bordas magenta — pareia com o objeto do
 * álbum (braço de luzes Fire Arena). Click abre o ShowLiveStage que
 * transforma a viewport num palco com vinheta dark + luzes pulsando +
 * frame de transmissão + chat.
 *
 * Self-contained: gate do brainstorm + open state owned aqui. Mount uma
 * vez em /app/page.tsx e esquece. Unmounta automaticamente quando o
 * brainstorm flag flipa pra off.
 */
export default function ShowLiveTrigger() {
  const { flags } = useBrainstormFlags();
  const [open, setOpen] = useState(false);

  if (!flags.showLive) return null;

  return (
    <>
      {/* Pílula esconde quando o stage está aberto — o palco vira
       *  a única UI visível. CSS também tem display:none gated
       *  por html[data-showlive] como reforço (race-proof). */}
      {!open && (
      <button
        type="button"
        className={styles.card}
        onClick={() => setOpen(true)}
        aria-label="Entrar no show ao vivo"
        title="Show ao vivo"
      >
        <span className={styles.label}>Show ao vivo</span>
      </button>
      )}

      <ShowLiveStage open={open} onClose={() => setOpen(false)} />
    </>
  );
}
