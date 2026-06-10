'use client';

import { useEffect, useState } from 'react';
import {
  getShowDayBounds,
  getShowDayPhase,
  type ShowDayPhase,
} from '@/lib/showDay';

/**
 * Fase do "Hoje tem show" reativa ao relógio — tick de 1s (o header
 * do painel mostra countdown/decorrido com segundos) + resync no
 * visibilitychange (aba estacionada de um dia pro outro vira a fase
 * correta na volta). O ShowDayLayer (imperativo, granularidade de
 * minuto) NÃO usa este hook — chama as funções puras com interval
 * próprio de 30s pra não re-renderizar nada por segundo.
 */
export function useShowDayPhase(): {
  phase: ShowDayPhase;
  startsAt: Date;
  endsAt: Date;
  /** > 0 só na fase announced. */
  countdownMs: number;
  /** > 0 só na fase live. */
  elapsedMs: number;
} {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const phase = getShowDayPhase(now);
  const { startsAt, endsAt } = getShowDayBounds(now);
  return {
    phase,
    startsAt,
    endsAt,
    countdownMs:
      phase === 'announced' ? startsAt.getTime() - now.getTime() : 0,
    elapsedMs: phase === 'live' ? now.getTime() - startsAt.getTime() : 0,
  };
}
