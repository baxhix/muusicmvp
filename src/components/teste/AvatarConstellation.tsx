'use client';

import { useEffect, useState } from 'react';
import FloatingAvatar from './FloatingAvatar';

/**
 * Constellation — todos os avatares do /teste num só lugar, com
 * posicionamento fixo na viewport.
 *
 * Mecânica per product feedback iter 3:
 *   - Cada avatar tem um `section` (1, 2 ou 3) — a section em
 *     que ele aparece. SWAP em vez de acumular: ao entrar
 *     numa nova section, os avatares da anterior FADE OUT e
 *     os novos FADE IN em posições diferentes.
 *   - Scroll listener (rAF throttled) detecta qual section
 *     ocupa o centro da viewport → seta `activeSection`.
 *   - position: fixed (em FloatingAvatar.module.css) ancora
 *     ao viewport — não scrollam com o documento.
 */

interface AvatarSlot {
  name: string;
  label: string;
  /** Section em que esse avatar aparece (1/2/3). */
  section: 1 | 2 | 3;
  /** Posicionamento fixed via CSS top/left/right/bottom. */
  style: React.CSSProperties;
}

/**
 * 9 avatares totais — 3 por section, em posições DIFERENTES
 * entre sections pra que o cross-dissolve seja perceptível
 * (não dá pra ter avatar B da seção 1 na mesma posição do C
 * da seção 2 ou parece que só trocaram as iniciais).
 *
 * Convenção de posicionamento:
 *   - Section 1: cantos (top-left, bottom-left, bottom-right)
 *   - Section 2: lateral oposta + meio (top-right, mid-left,
 *     mid-right)
 *   - Section 3: trio fundo (bottom-left, center-bottom,
 *     top-center)
 */
const AVATARS: AvatarSlot[] = [
  // ── Section 1 — cantos ───────────────────────────────────
  {
    name: 'Marina',
    label: 'Boiadeira - Ana Castela',
    section: 1,
    style: { top: '16%', left: '6%' },
  },
  {
    name: 'Rafael',
    label: 'Boiadeira - Ana Castela',
    section: 1,
    style: { bottom: '20%', left: '4%' },
  },
  {
    name: 'Clara',
    label: 'Pipoco - Ana Castela',
    section: 1,
    style: { bottom: '20%', right: '4%' },
  },

  // ── Section 2 — meios laterais + topo direito ────────────
  {
    name: 'Júlia',
    label: 'Solto - Ana Castela',
    section: 2,
    style: { top: '50%', left: '8%' },
  },
  {
    name: 'Pedro',
    label: 'Pipoco - Ana Castela',
    section: 2,
    style: { top: '18%', right: '10%' },
  },
  {
    name: 'Camila',
    label: 'Tropa do Chapelão',
    section: 2,
    style: { top: '54%', right: '12%' },
  },

  // ── Section 3 — trio fundo + topo centro ─────────────────
  {
    name: 'Heitor',
    label: 'Rodeio no Texas',
    section: 3,
    style: { top: '18%', left: '50%' },
  },
  {
    name: 'Lia',
    label: 'Boiadeira - Ana Castela',
    section: 3,
    style: { bottom: '14%', left: '18%' },
  },
  {
    name: 'Bruno',
    label: 'Solto - Ana Castela',
    section: 3,
    style: { bottom: '18%', right: '20%' },
  },
];

export default function AvatarConstellation() {
  /** Section atualmente ativa (centro da viewport). Começa em
   *  1 pra mostrar a constelação inicial assim que monta. */
  const [activeSection, setActiveSection] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    /**
     * Detecta a section "ativa" pelo scroll: a section cujo
     * range vertical contém o CENTRO da viewport. Mais
     * confiável que IntersectionObserver em alguns ambientes
     * (preview iframes, etc.) e mais explícito sobre quando
     * o trigger acontece — o usuário precisa rolar metade da
     * seção pra revelar a próxima rodada de avatares.
     *
     * Listener com `{ passive: true }` pra não bloquear o
     * scroll do navegador. requestAnimationFrame throttle
     * pra evitar dezenas de setState por frame durante um
     * scroll rápido.
     */
    let raf = 0;
    function checkActiveSection() {
      const center = window.innerHeight * 0.5;
      let active: 1 | 2 | 3 = 1;
      for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`section-${i}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= center && r.bottom >= center) {
          active = i as 1 | 2 | 3;
          break;
        }
      }
      // Atualiza SEMPRE pra a section atual — não acumula.
      // Cada section mostra APENAS seus próprios avatares
      // (cross-dissolve no scroll).
      setActiveSection((prev) => (prev === active ? prev : active));
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        checkActiveSection();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // Check inicial — caso o usuário aterrisse já scrollado.
    checkActiveSection();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {AVATARS.map((a) => (
        <FloatingAvatar
          key={a.name}
          name={a.name}
          label={a.label}
          size="sm"
          revealed={a.section === activeSection}
          style={a.style}
        />
      ))}
    </>
  );
}
