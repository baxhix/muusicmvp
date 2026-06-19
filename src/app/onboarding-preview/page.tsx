'use client';

import { useState } from 'react';
import OnboardingTourView from '@/components/app/OnboardingTourView';
import { DEFAULT_ONBOARDING_TOUR } from '@/lib/app/onboardingTourSteps';

/**
 * Rota interna de PREVIEW do tour de onboarding (sandbox).
 *
 * Renderiza apenas o `OnboardingTourView` (camada de apresentação,
 * sem dependência do shell /app) sobre um fundo mock, pra validar o
 * visual/animações sem subir o app inteiro (que depende de Mapbox e
 * não roda no preview local). Não é linkada em lugar nenhum.
 */

export default function OnboardingPreviewPage() {
  const config = DEFAULT_ONBOARDING_TOUR;
  const [phase, setPhase] = useState<'steps' | 'done'>('steps');
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);

  const last = config.steps.length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background:
          'radial-gradient(120% 80% at 50% 0%, #2a1840 0%, #0a0712 55%, #050308 100%)',
      }}
    >
      {/* Mock de "UI atrás" pra dar textura ao scrim/blur. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 22px)',
        }}
      />
      <OnboardingTourView
        config={config}
        phase={phase}
        idx={idx}
        dir={dir}
        reduce={false}
        onNext={() => {
          setDir(1);
          setIdx((i) => {
            if (i >= last) {
              setPhase('done');
              return i;
            }
            return i + 1;
          });
        }}
        onPrev={() => {
          setDir(-1);
          setIdx((i) => Math.max(0, i - 1));
        }}
        onSkip={() => {
          setDir(1);
          setPhase('done');
        }}
        onFinishDone={() => {
          setPhase('steps');
          setIdx(0);
        }}
        onRestart={() => {
          setDir(-1);
          setPhase('steps');
          setIdx(0);
        }}
      />
    </div>
  );
}
