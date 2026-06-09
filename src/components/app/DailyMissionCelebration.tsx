'use client';

import { useEffect, useRef } from 'react';
import { useDailyMissions } from '@/hooks/useDailyMissions';
import { fireMotionConfetti } from './MotionConfetti';

/**
 * DailyMissionCelebration — dispara o MotionConfetti quando uma
 * missão do dia transiciona de pendente → concluída.
 *
 * Mecânica:
 *   - Usa `useDailyMissions` (polling 60s + refresh manual). A
 *     cada update do array, compara o conjunto de IDs `done`
 *     com o snapshot anterior (ref).
 *   - Qualquer ID novo no set de "done" → dispara um burst de
 *     confetti centrado um pouco acima do meio da viewport.
 *   - Bursts são debouncados naturalmente pelo fato de o set
 *     anterior ser atualizado depois do dispatch — se o user
 *     fechar 2 missões no mesmo tick, dispara 2 bursts em
 *     sequência (Motion enfileira; cleanup de cada respeita
 *     o `duration` configurado no MotionConfetti).
 *   - Primeiro fetch é silenciado (ref começa null, populado
 *     no primeiro effect run sem comparar) pra evitar disparar
 *     no mount inicial — só celebra transições REAIS.
 *
 * Sem UI própria — componente puro de side-effect. Monta uma
 * vez no layout do app, junto com AchievementCelebration.
 */
export default function DailyMissionCelebration() {
  const { missions } = useDailyMissions();
  const prevDoneRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!missions) return;
    const currentDone = new Set(
      missions.filter((m) => m.done).map((m) => m.id),
    );

    /* Primeiro mount com dados: só popula o snapshot e sai.
     *  Sem isso, qualquer missão JÁ concluída no carregamento
     *  dispararia confetti no refresh da página — irritante. */
    if (prevDoneRef.current === null) {
      prevDoneRef.current = currentDone;
      return;
    }

    /* Diff: IDs que estão em current mas NÃO em prev. */
    const newlyCompleted: string[] = [];
    currentDone.forEach((id) => {
      if (!prevDoneRef.current!.has(id)) newlyCompleted.push(id);
    });

    if (newlyCompleted.length > 0) {
      /* Origem centrada-acima — onde os marcos visuais do
       *  ArtistBox tendem a ficar (lista de missões na fold). */
      fireMotionConfetti({ origin: { x: 0.5, y: 0.45 } });
    }

    prevDoneRef.current = currentDone;
  }, [missions]);

  return null;
}
