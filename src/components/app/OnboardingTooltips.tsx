'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppShell } from '@/lib/app/AppShellContext';
import {
  ONBOARDING_STEPS,
  isOnboardingDone,
  markOnboardingDone,
  type OnboardingStep,
} from '@/lib/onboarding';
import styles from './OnboardingTooltips.module.css';

/* ============================================================
 * Onboarding Tooltips — P0.3 do roadmap de engajamento
 *
 * 3 tooltips sequenciais que apontam pra: Fanpoints (header
 * ArtistBox), Chat (BottomNav slot), Ranking (BottomNav slot
 * Superfãs). Aguarda welcomeStage >= 5 (cinematic flyTo OK) +
 * pequeno delay pra UI assentar, então renderiza o primeiro
 * step.
 *
 * Persistência: marca "done" só quando o user chega no fim OU
 * clica Pular tudo — se fechar o app antes, volta na próxima.
 *
 * Posicionamento: cada step procura sua âncora via
 * `[data-onboarding-anchor="..."]`. Se a âncora não estiver
 * montada (ex.: ArtistBox escondida em chat detail mobile),
 * pulamos pro próximo step automaticamente.
 * ============================================================ */

const ENTRY_DELAY_MS = 600;
/* Espaço entre tooltip e âncora. */
const ANCHOR_GAP_PX = 12;
/* Padding mínimo da borda da viewport ao tooltip. */
const VIEWPORT_PAD_PX = 12;
/* Tooltip width — também spelled no CSS. Repetimos aqui pra
 * calcular o clamp horizontal sem ler computed style. */
const TOOLTIP_WIDTH_PX = 320;

interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export default function OnboardingTooltips() {
  const { welcomeStage } = useAppShell();

  /* `active` = controller decidiu mostrar a tour nessa sessão.
   * Setado uma vez no mount (se o user ainda não concluiu) e
   * fica true até completar/pular — não re-checa o flag, pra
   * não interromper a tour caso o flag mude num side-effect. */
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  /* `mounted` guarda o portal só pra browser (SSR safe). */
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  /* Disparador: welcomeStage >= 5 (final do reveal sequencial)
   * + flag ainda não setada → ativa após ENTRY_DELAY_MS. Roda
   * UMA vez por sessão; reabrir a aba renicia se o user pulou
   * sem concluir. */
  useEffect(() => {
    if (active) return;
    if (welcomeStage < 5) return;
    if (isOnboardingDone()) return;
    const t = window.setTimeout(() => {
      setActive(true);
      setStepIdx(0);
    }, ENTRY_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [welcomeStage, active]);

  /* Listener pra "Refazer tour" — quando o flag é apagado em
   * Configurações, re-disparamos a tour imediatamente. */
  useEffect(() => {
    const onChange = () => {
      if (isOnboardingDone()) return;
      setActive(true);
      setStepIdx(0);
    };
    window.addEventListener('app:onboarding-done-changed', onChange);
    return () =>
      window.removeEventListener('app:onboarding-done-changed', onChange);
  }, []);

  const currentStep: OnboardingStep | undefined = ONBOARDING_STEPS[stepIdx];

  /* Localizar âncora + recalcular rect quando o step muda OU a
   * viewport redimensiona. useLayoutEffect pra evitar flash:
   * mede e posiciona antes do paint. */
  useLayoutEffect(() => {
    if (!active || !currentStep) {
      setRect(null);
      return;
    }
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(
        `[data-onboarding-anchor="${currentStep.anchor}"]`,
      );
      if (!el) {
        /* Âncora ausente — pula pro próximo step. Se foi o
         * último, encerra. */
        if (stepIdx < ONBOARDING_STEPS.length - 1) {
          setStepIdx((i) => i + 1);
        } else {
          finish();
        }
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      });
    };

    /* requestAnimationFrame garante que medições aconteçam
     * depois do paint anterior (caso o step anterior tenha
     * deslocado layout). */
    const raf = requestAnimationFrame(measure);

    /* Re-mede em resize + scroll (pinch-zoom em iOS, rotação,
     * etc). throttled implicit pelo browser. */
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIdx, currentStep?.anchor]);

  const finish = useCallback(() => {
    markOnboardingDone();
    setActive(false);
  }, []);

  const next = useCallback(() => {
    if (stepIdx < ONBOARDING_STEPS.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      finish();
    }
  }, [stepIdx, finish]);

  /* Pular tudo conta como "concluído" pra que o flag seja
   * gravado e a tour não volte. */
  const skip = useCallback(() => {
    finish();
  }, [finish]);

  /* ESC pula tudo. Útil pra keyboard nav. */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, skip]);

  if (!mounted || !active || !currentStep || !rect) return null;

  /* ── Posicionamento ──
   * Resolve placement preferido. Se não couber acima/abaixo
   * (tooltip mediria ~180px de altura), tenta flip. */
  const isLast = stepIdx === ONBOARDING_STEPS.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  /* Heurística: card tem ~200px de altura no maior step. Usado
   * só pra decidir flip se o placement preferido não couber. */
  const ESTIMATED_HEIGHT = 200;
  let placement = currentStep.placement;
  if (placement === 'bottom' && rect.bottom + ANCHOR_GAP_PX + ESTIMATED_HEIGHT > vh - VIEWPORT_PAD_PX) {
    placement = 'top';
  } else if (placement === 'top' && rect.top - ANCHOR_GAP_PX - ESTIMATED_HEIGHT < VIEWPORT_PAD_PX) {
    placement = 'bottom';
  }

  /* Top: relativo ao placement. Left: centra no eixo X da
   * âncora mas clampa pra ficar dentro da viewport. */
  const anchorCenterX = rect.left + rect.width / 2;
  let left = anchorCenterX - TOOLTIP_WIDTH_PX / 2;
  left = Math.max(VIEWPORT_PAD_PX, Math.min(left, vw - TOOLTIP_WIDTH_PX - VIEWPORT_PAD_PX));

  const top =
    placement === 'bottom'
      ? rect.bottom + ANCHOR_GAP_PX
      : rect.top - ANCHOR_GAP_PX; // top: subtraído porque CSS usa translateY(-100%) no card

  /* Posição absoluta da setinha relativa ao card. */
  const arrowLeft = Math.max(
    16,
    Math.min(anchorCenterX - left, TOOLTIP_WIDTH_PX - 16),
  );

  /* Spotlight cutout — recorta a área da âncora pro user ver
   * o que o tooltip aponta. inset-box-shadow gigante simula
   * um "buraco" no overlay sem precisar de SVG mask. */
  const spotlightPadding = 8;
  const spotlightStyle: React.CSSProperties = {
    top: rect.top - spotlightPadding,
    left: rect.left - spotlightPadding,
    width: rect.width + spotlightPadding * 2,
    height: rect.height + spotlightPadding * 2,
  };

  return createPortal(
    <div
      className={styles.overlay}
      onClick={skip}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* Spotlight ring em volta da âncora. */}
      <div className={styles.spotlight} style={spotlightStyle} aria-hidden="true" />

      {/* Tooltip card. */}
      <div
        className={`${styles.card} ${placement === 'top' ? styles.cardTop : styles.cardBottom}`}
        style={{
          top: placement === 'top' ? undefined : top,
          bottom: placement === 'top' ? vh - top : undefined,
          left,
          width: TOOLTIP_WIDTH_PX,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={styles.arrow}
          style={{ left: arrowLeft }}
          aria-hidden="true"
        />
        <span className={styles.counter}>{currentStep.counter}</span>
        <h3 id="onboarding-title" className={styles.title}>
          {currentStep.title}
        </h3>
        <p className={styles.body}>{currentStep.body}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.skip}
            onClick={skip}
          >
            Pular tudo
          </button>
          <button
            type="button"
            className={styles.next}
            onClick={next}
            autoFocus
          >
            {isLast ? 'Concluir' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
