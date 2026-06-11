'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShowDayPhase } from '@/lib/showDay';
import {
  ATTENDEES_BASE_ANNOUNCED,
  ATTENDEES_BASE_LIVE,
  CENTRAL_CAPTIONS_ANNOUNCED,
  CENTRAL_CAPTIONS_LIVE,
  CENTRAL_SENDER,
  SHOW_DAY_FANS,
  SHOW_DAY_MESSAGES_ANNOUNCED,
  SHOW_DAY_MESSAGES_LIVE,
  SHOW_DAY_PHOTOS,
  type SimSender,
  type SimShowMessage,
} from '@/data/showDayFeed';

/* ============================================================
 * MOTOR da simulação do chat de show — generalização do
 * scheduler do ShowLiveStage (setTimeout auto-reagendado +
 * cursores coprimos sobre os pools + cap de 50 mensagens),
 * parametrizado por FASE:
 *
 *   Timer A (fãs):     announced 6–12s · live 2–5s (1º tick 700ms)
 *   Timer B (Central): FOTO + legenda em todas as fases (teaser/bastidores
 *                      na announced, registros na live); 1º tick ~4s
 *   Timer C (count):   interval 4s — announced cresce ("chegando"),
 *                      live drifta ± com floor
 *   Seed:              6 mensagens determinísticas no rising edge
 *
 * FULL STOP quando `active` é false: timers limpos e estado
 * zerado — o painel é montado permanente no layout, então nada
 * pode rodar com a superfície fechada. Reabrir re-semeia.
 * ============================================================ */

const MAX_VISIBLE_MESSAGES = 50;

const FAN_TICK = {
  announced: { min: 6_000, max: 12_000 },
  live: { min: 2_000, max: 5_000 },
} as const;

const CENTRAL_TICK = {
  announced: { min: 18_000, max: 34_000 },
  live: { min: 26_000, max: 48_000 },
} as const;

function randBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

export function useShowDaySimulation(opts: {
  phase: ShowDayPhase;
  /** Painel aberto — gate de TODOS os timers. */
  active: boolean;
}): {
  messages: SimShowMessage[];
  attendeeCount: number;
  appendLocal: (body: string, sender: SimSender) => void;
} {
  const { phase, active } = opts;
  const [messages, setMessages] = useState<SimShowMessage[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(ATTENDEES_BASE_ANNOUNCED);

  /* Cursores determinísticos (passos coprimos com os tamanhos dos
   * pools — sequência longa sem repetição perceptível). Refs pra
   * sobreviver re-renders sem re-disparar effects. */
  const counterRef = useRef(0);
  const fanCursorRef = useRef(0);
  const msgCursorRef = useRef(0);
  const photoCursorRef = useRef(0);
  const captionCursorRef = useRef(0);

  const append = useCallback((msg: SimShowMessage) => {
    setMessages((curr) => {
      const merged = [...curr, msg];
      return merged.length > MAX_VISIBLE_MESSAGES
        ? merged.slice(merged.length - MAX_VISIBLE_MESSAGES)
        : merged;
    });
  }, []);

  /* Seed + reset no edge de `active`. */
  useEffect(() => {
    if (!active) {
      setMessages([]);
      counterRef.current = 0;
      fanCursorRef.current = 0;
      msgCursorRef.current = 0;
      photoCursorRef.current = 0;
      captionCursorRef.current = 0;
      return;
    }
    const pool =
      phase === 'announced'
        ? SHOW_DAY_MESSAGES_ANNOUNCED
        : SHOW_DAY_MESSAGES_LIVE;
    const seed: SimShowMessage[] = [];
    for (let i = 0; i < 6; i++) {
      seed.push({
        id: -1 - i,
        sender: SHOW_DAY_FANS[(i * 3) % SHOW_DAY_FANS.length],
        body: pool[(i * 5) % pool.length],
      });
    }
    setMessages(seed);
    setAttendeeCount(
      phase === 'live' ? ATTENDEES_BASE_LIVE : ATTENDEES_BASE_ANNOUNCED,
    );
    // `phase` fora dos deps de propósito: o seed só acontece no
    // open/close; a virada de fase com o painel aberto é coberta
    // pelos timers abaixo (que têm `phase` nos deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /* Timer A — mensagens de fãs. */
  useEffect(() => {
    if (!active || phase === 'ended') return;
    const pool =
      phase === 'announced'
        ? SHOW_DAY_MESSAGES_ANNOUNCED
        : SHOW_DAY_MESSAGES_LIVE;
    const { min, max } = FAN_TICK[phase];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const fan = SHOW_DAY_FANS[fanCursorRef.current % SHOW_DAY_FANS.length];
      const body = pool[msgCursorRef.current % pool.length];
      fanCursorRef.current += 7;
      msgCursorRef.current += 11;
      counterRef.current += 1;
      append({ id: counterRef.current, sender: fan, body });
      timer = setTimeout(tick, randBetween(min, max));
    };
    timer = setTimeout(tick, 700);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [active, phase, append]);

  /* Timer B — Central Ana Castela (texto na announced, foto na live). */
  useEffect(() => {
    if (!active || phase === 'ended') return;
    const captions =
      phase === 'announced'
        ? CENTRAL_CAPTIONS_ANNOUNCED
        : CENTRAL_CAPTIONS_LIVE;
    const { min, max } = CENTRAL_TICK[phase];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const caption = captions[captionCursorRef.current % captions.length];
      captionCursorRef.current += 3;
      counterRef.current += 1;
      // A Central SEMPRE manda foto (bastidores/teaser na announced,
      // registros do show na live) — é o diferencial da superfície.
      const msg: SimShowMessage = {
        id: counterRef.current,
        sender: CENTRAL_SENDER,
        body: caption,
        photo: SHOW_DAY_PHOTOS[photoCursorRef.current % SHOW_DAY_PHOTOS.length],
      };
      photoCursorRef.current += 1;
      append(msg);
      timer = setTimeout(tick, randBetween(min, max));
    };
    // 1ª foto em ~4s pro user ver o diferencial logo ao abrir (qualquer fase).
    timer = setTimeout(tick, 4_000);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [active, phase, append]);

  /* Timer C — drift do contador de presentes. */
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setAttendeeCount((curr) => {
        if (phase === 'live') {
          const delta = randBetween(-15, 21);
          return Math.max(ATTENDEES_BASE_LIVE - 120, curr + delta);
        }
        // announced/ended: público "chegando" — só cresce, devagar.
        return curr + randBetween(0, 6);
      });
    }, 4_000);
    return () => clearInterval(id);
  }, [active, phase]);

  const appendLocal = useCallback(
    (body: string, sender: SimSender) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      counterRef.current += 1;
      append({
        id: counterRef.current,
        sender,
        body: trimmed,
        isSelf: true,
      });
    },
    [append],
  );

  return { messages, attendeeCount, appendLocal };
}
