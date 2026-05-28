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
        aria-label="Entrar no show ao vivo da Arena Fonte Nova"
        title="Show ao vivo · Fire Arena"
      >
        <span className={styles.pulse} aria-hidden="true" />

        <span className={styles.liveBadge}>
          <span className={styles.liveDot} aria-hidden="true" />
          AO VIVO
        </span>

        <span className={styles.identity}>
          <span className={styles.name}>FIRE ARENA</span>
          <span className={styles.venue}>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s-7-5.5-7-12a7 7 0 0 1 14 0c0 6.5-7 12-7 12z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            Arena Fonte Nova · BA
          </span>
        </span>

        <span className={styles.cta}>
          Entrar no palco
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </button>
      )}

      <ShowLiveStage open={open} onClose={() => setOpen(false)} />
    </>
  );
}
