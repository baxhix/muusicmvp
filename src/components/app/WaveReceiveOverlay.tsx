'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './WaveReceiveOverlay.module.css';

/* ============================================================
 * WAVE RECEIVE OVERLAY
 *
 * Mounted at the layout level alongside `HeartsCascade`. Fires
 * a black semi-transparent overlay + centered "[sender] enviou
 * corações para você" message whenever the realtime layer
 * delivers a `notify:new` of kind `waved` (see
 * `useNotificationsLive`'s onNew handler → it dispatches
 * `app:hearts-cascade` with `{ sourceUserId, sourceName }` in
 * the detail). The sender's name is a Next.js Link to their
 * `/app/u/[id]` profile so the receiver can tap through to
 * thank them. Per product feedback "Quando um usuário enviar
 * corações para outro, a tela do usuário que receber, além dos
 * corações caindo, deverá ficar com uma camada preta com
 * transparência leve e a mensagem centralizada '[nome do
 * usuário] enviou corações para você' O nome do usuário deverá
 * ser um click para o seu perfil".
 *
 * Lifecycle:
 *   - Event lands → component records sourceUserId + sourceName
 *     and starts a 3500ms self-dismiss timer.
 *   - Tapping the backdrop dismisses early. The Link click on
 *     the username navigates and naturally tears down the
 *     overlay along with the rest of the route.
 *   - A fresh wave arriving mid-overlay resets the timer +
 *     swaps the displayed name in place — no flicker, no
 *     stacking.
 * ============================================================ */

interface WavePayload {
  sourceUserId: string | null;
  sourceName: string | null;
}

const OVERLAY_TTL_MS = 3500;

export default function WaveReceiveOverlay() {
  const [wave, setWave] = useState<WavePayload | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<WavePayload | undefined>).detail;
      // The mock toast rotator also fires `app:hearts-cascade`
      // without a detail payload — those bursts already have
      // their own toast and shouldn't double up with this
      // overlay. Only render when a real sender is identified
      // (i.e., a socket-driven wave delivered a sourceName).
      if (!detail || !detail.sourceName) return;
      setWave({
        sourceUserId: detail.sourceUserId,
        sourceName: detail.sourceName,
      });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setWave(null), OVERLAY_TTL_MS);
    };
    window.addEventListener('app:hearts-cascade', handler);
    return () => {
      window.removeEventListener('app:hearts-cascade', handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!wave) return null;

  return (
    <div
      className={styles.root}
      role="status"
      aria-live="polite"
      onClick={() => setWave(null)}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.message}>
        {wave.sourceUserId ? (
          <Link
            href={`/app/u/${wave.sourceUserId}`}
            className={styles.senderLink}
            // Stop propagation so the Link click navigates without
            // also firing the backdrop's onClick dismiss handler.
            // The route change unmounts this overlay naturally.
            onClick={(e) => e.stopPropagation()}
          >
            {wave.sourceName}
          </Link>
        ) : (
          <span className={styles.senderLink}>{wave.sourceName}</span>
        )}{' '}
        enviou corações para você
      </div>
    </div>
  );
}
