'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useAppShell } from '@/lib/app/AppShellContext';
import { track } from '@/lib/analytics';
import {
  DEFAULT_ONBOARDING_TOUR,
  type OnboardingTourConfig,
  type OnboardingTourStep,
} from '@/lib/app/onboardingTourSteps';
import OnboardingTourView from './OnboardingTourView';

/**
 * OnboardingTour — container do tour de boas-vindas in-app.
 *
 * Self-mounting (igual FanpointsModal): montado uma vez no shell
 * (/app/app/layout.tsx). Responsável por estado, gatilhos e
 * analytics; delega a UI pro `OnboardingTourView`.
 *
 * Gatilhos:
 *  - Auto (1×): novo cadastro (`?welcome=1`) + ainda não viu o tour,
 *    disparado ~após o welcome reveal (welcomeStage 5). Marca
 *    `fanverse.tour.seen.v1` pra não repetir.
 *  - Manual: CustomEvent `app:open-tour` (botão "Rever tour" nas
 *    Configurações da TopBar) — ignora o flag de "já visto".
 *
 * Fase 2: trocar `DEFAULT_ONBOARDING_TOUR` por config vinda do
 * painel (a prop `config` já permite isso).
 */

const SEEN_KEY = 'fanverse.tour.seen.v1';

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage indisponível — segue sem persistir */
  }
}

export default function OnboardingTour({
  config = DEFAULT_ONBOARDING_TOUR,
}: {
  config?: OnboardingTourConfig;
}) {
  const { welcomeStage } = useAppShell();
  const reduce = useReducedMotion() ?? false;

  /* Config efetiva: começa com a prop (default estático) e, no
   * mount, tenta sobrescrever os passos com os cards publicados no
   * admin (GET /api/onboarding-tour). Se a API falhar ou vier
   * vazia, mantém o DEFAULT_ONBOARDING_TOUR — o tour nunca quebra. */
  const [resolvedConfig, setResolvedConfig] = useState<OnboardingTourConfig>(config);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/onboarding-tour', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { steps?: OnboardingTourStep[] };
        if (alive && data.steps && data.steps.length > 0) {
          setResolvedConfig((c) => ({ ...c, steps: data.steps! }));
        }
      } catch {
        /* offline / erro — segue com o fallback estático */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const [phase, setPhase] = useState<'closed' | 'steps' | 'done'>('closed');
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);

  const lockRef = useRef(false);
  /* Captura se esta sessão é de um cadastro novo ANTES do attr
   * `data-welcome` ser removido (~1.5s após o load). */
  const isNewWelcome = useRef(false);
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('welcome');
    const attr = document.documentElement.getAttribute('data-welcome');
    isNewWelcome.current = param === '1' || attr === '1';
  }, []);

  const lock = useCallback(() => {
    if (lockRef.current) return false;
    lockRef.current = true;
    window.setTimeout(() => {
      lockRef.current = false;
    }, reduce ? 0 : 360);
    return true;
  }, [reduce]);

  const open = useCallback(() => {
    setIdx(0);
    setDir(1);
    setPhase('steps');
  }, []);

  /* Replay manual via evento global. */
  useEffect(() => {
    function onOpen() {
      markSeen();
      open();
      track('onboarding_tour_opened', { source: 'manual' });
    }
    window.addEventListener('app:open-tour', onOpen);
    return () => window.removeEventListener('app:open-tour', onOpen);
  }, [open]);

  /* Auto-open 1× pra cadastro novo, após o welcome reveal. */
  useEffect(() => {
    if (phase !== 'closed') return;
    if (welcomeStage < 5) return;
    if (!isNewWelcome.current) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      seen = false;
    }
    if (seen) return;
    const t = window.setTimeout(() => {
      markSeen();
      open();
      track('onboarding_tour_opened', { source: 'auto' });
    }, 600);
    return () => window.clearTimeout(t);
  }, [welcomeStage, phase, open]);

  const steps = resolvedConfig.steps;
  const last = steps.length - 1;

  const next = useCallback(() => {
    if (!lock()) return;
    setDir(1);
    setIdx((i) => {
      if (i >= last) {
        setPhase('done');
        track('onboarding_tour_completed', {});
        return i;
      }
      return i + 1;
    });
  }, [lock, last]);

  const prev = useCallback(() => {
    if (!lock()) return;
    setIdx((i) => {
      if (i <= 0) return i;
      setDir(-1);
      return i - 1;
    });
  }, [lock]);

  const skip = useCallback(() => {
    if (!lock()) return;
    setDir(1);
    setPhase('done');
    track('onboarding_tour_skipped', { at: idx });
  }, [lock, idx]);

  const finishDone = useCallback(() => {
    setPhase('closed');
  }, []);

  const restart = useCallback(() => {
    if (!lock()) return;
    setDir(-1);
    setIdx(0);
    setPhase('steps');
  }, [lock]);

  /* Navegação por teclado. */
  useEffect(() => {
    if (phase === 'closed') return;
    function onKey(e: KeyboardEvent) {
      if (phase === 'done') {
        if (e.key === 'Escape' || e.key === 'Enter') finishDone();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') skip();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, next, prev, skip, finishDone]);

  if (phase === 'closed') return null;

  return (
    <OnboardingTourView
      config={resolvedConfig}
      phase={phase}
      idx={idx}
      dir={dir}
      reduce={reduce}
      onNext={next}
      onPrev={prev}
      onSkip={skip}
      onFinishDone={finishDone}
      onRestart={restart}
    />
  );
}
