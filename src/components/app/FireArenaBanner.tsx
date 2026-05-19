'use client';

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import styles from './FireArenaBanner.module.css';

/* ============================================================
 * FIRE ARENA BANNER — desktop-only launch countdown
 *
 * Spotify-style launch promo banner pinned to the top of the
 * desktop viewport. Renders the Fire Arena cover art on the
 * left, the title + Ana Castela byline + a four-unit countdown
 * (Days / Hours / Minutes / Seconds) on the right.
 *
 * Hidden on mobile per spec ("Crie um banner para ficar fixo
 * no Desktop") so phone viewports keep the existing chrome
 * uninterrupted.
 *
 * The launch date is hard-coded for the mock — wire to a real
 * `launchAt` prop / backend field when the feature ships.
 * ============================================================ */

/** Launch timestamp (ISO, BR timezone-equivalent). The mock
 *  matches the user-supplied promo date "28 de maio de 2026"
 *  at 20:00 local — a typical primetime event slot. */
const LAUNCH_AT = new Date('2026-05-28T20:00:00-03:00').getTime();

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Compute the remaining time until the launch. Returns
 *  all-zeros once the launch is reached or passed. */
function diffNow(): Countdown {
  const ms = Math.max(0, LAUNCH_AT - Date.now());
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

/** Pad a number to two digits with a leading zero. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function FireArenaBanner() {
  const isMobile = useIsMobile();
  const [countdown, setCountdown] = useState<Countdown>(() => diffNow());

  useEffect(() => {
    // 1-second tick — cheap, and the seconds digit needs the
    // resolution. The interval auto-suspends when the tab is
    // backgrounded thanks to the browser's setInterval
    // throttling, so no extra visibility-change handling here.
    const id = setInterval(() => {
      setCountdown(diffNow());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (isMobile) return null;

  return (
    <div className={styles.banner} role="region" aria-label="Lançamento Fire Arena">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/firearena.png"
        alt="Fire Arena"
        className={styles.cover}
      />

      <div className={styles.info}>
        <h2 className={styles.title}>
          Fire Arena
          <span className={styles.emoji} aria-hidden="true">
            ❤️‍🔥
          </span>
        </h2>

        <div className={styles.byline}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ana-castela.png"
            alt=""
            className={styles.bylineAvatar}
            aria-hidden="true"
          />
          <span className={styles.bylineName}>Ana Castela</span>
          <span className={styles.bylineSep} aria-hidden="true">·</span>
          <span className={styles.bylineLaunch}>
            Lançamento em 28 de maio de 2026
          </span>
        </div>

        <div
          className={styles.countdown}
          role="timer"
          aria-live="off"
          aria-label={`Faltam ${countdown.days} dias, ${countdown.hours} horas, ${countdown.minutes} minutos`}
        >
          <CountdownUnit value={countdown.days} label="Dias" />
          <span className={styles.countdownSep} aria-hidden="true">|</span>
          <CountdownUnit value={pad(countdown.hours)} label="Horas" />
          <span className={styles.countdownSep} aria-hidden="true">|</span>
          <CountdownUnit value={pad(countdown.minutes)} label="Minutos" />
          <span className={styles.countdownSep} aria-hidden="true">|</span>
          <CountdownUnit value={pad(countdown.seconds)} label="Segundos" />
        </div>
      </div>
    </div>
  );
}

function CountdownUnit({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className={styles.unit}>
      <span className={styles.unitValue}>{value}</span>
      <span className={styles.unitLabel}>{label}</span>
    </div>
  );
}
